import json
import os
import uuid
from google import genai
from pinecone import Pinecone
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

index_name = os.environ.get("PINECONE_INDEX_NAME", "cat-prep-index")


def _get_clients():
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    pinecone_api_key = os.environ.get("PINECONE_API_KEY")
    if not gemini_api_key or not pinecone_api_key:
        raise RuntimeError(
            "AI services are not configured. Set GEMINI_API_KEY and PINECONE_API_KEY in backend/.env."
        )

    client = genai.Client(api_key=gemini_api_key)
    pc = Pinecone(api_key=pinecone_api_key)
    return client, pc


def _is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    retry_markers = (
        "429",
        "500",
        "502",
        "503",
        "504",
        "unavailable",
        "high demand",
        "timeout",
        "timed out",
        "connection reset",
        "temporar",
        "rate limit",
        "resource exhausted",
        "deadline exceeded",
    )
    return any(marker in message for marker in retry_markers)


def _strip_code_fences(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _fallback_flashcards(topic: str, count: int):
    safe_topic = topic or "CAT Concepts"
    templates = [
        {
            "front": f"{safe_topic}: Core Formula",
            "back": "State the main rule, formula, or relationship for this topic.",
            "explanation": f"Use this as a quick recall anchor before solving harder {safe_topic} questions.",
            "topic": safe_topic,
        },
        {
            "front": f"{safe_topic}: Common Trap",
            "back": "Identify the hidden assumption before applying the first visible method.",
            "explanation": f"CAT questions in {safe_topic} often punish mechanical solving without checking constraints.",
            "topic": safe_topic,
        },
        {
            "front": f"{safe_topic}: Fast Elimination",
            "back": "Use option elimination before full calculation whenever the answer choices are structurally different.",
            "explanation": "This reduces solve time and is often the highest-yield exam tactic.",
            "topic": safe_topic,
        },
        {
            "front": f"{safe_topic}: Accuracy Check",
            "back": "Re-read the final quantity being asked before locking the answer.",
            "explanation": "Many CAT errors come from solving correctly but answering the wrong target.",
            "topic": safe_topic,
        },
        {
            "front": f"{safe_topic}: Revision Prompt",
            "back": "Summarize the concept in one line and solve one representative question immediately after.",
            "explanation": "Active recall plus immediate application helps retention far better than passive review.",
            "topic": safe_topic,
        },
    ]
    return templates[: max(1, min(count, len(templates)))]


def _normalize_flashcards(cards, topic: str, count: int):
    normalized = []
    safe_topic = topic or "CAT Concepts"
    for card in cards or []:
        if not isinstance(card, dict):
            continue
        front = str(card.get("front", "")).strip()
        back = str(card.get("back", "")).strip()
        explanation = str(card.get("explanation", "")).strip()
        if not front or not back or not explanation:
            continue
        normalized.append(
            {
                "id": str(uuid.uuid4()),
                "front": front,
                "back": back,
                "explanation": explanation,
                "topic": str(card.get("topic") or safe_topic),
            }
        )
        if len(normalized) >= max(1, count):
            break

    if normalized:
        return normalized

    fallback_cards = _fallback_flashcards(safe_topic, count)
    for card in fallback_cards:
        card["id"] = str(uuid.uuid4())
    return fallback_cards


def generate_question_clone(topic: str, difficulty: str):
    client, pc = _get_clients()

    # Step 1: Embed the query to find similar questions in Pinecone
    query_text = f"{topic} CAT question {difficulty} difficulty"
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception(_is_retryable_error),
    )
    def _embed_query():
        return client.models.embed_content(
            model="gemini-embedding-001",
            contents=query_text,
            config=genai.types.EmbedContentConfig(output_dimensionality=768)
        )
    
    embed_response = _embed_query()
    embedding = embed_response.embeddings[0].values
    
    index = pc.Index(index_name)
    search_results = index.query(
        vector=embedding,
        top_k=3,
        include_metadata=True
    )
    
    # Step 2: Use the fetched context to prompt Gemini for a clone
    context = ""
    if search_results and 'matches' in search_results:
        for match in search_results['matches']:
            meta = match.get('metadata', {})
            context += f"Q: {meta.get('question_text', '')}\n"
    
    prompt = f"""
    You are an expert CAT exam setter. Based on the following example questions, generate a NEW, high-quality question on {topic} with {difficulty} difficulty.
    It should have the same logical structure but use different variables, names, or numbers.
    Include 4 options, the correct answer, and a concept hint.
    
    Examples:
    {context}
    
    Return as JSON: {{"question_text": "...", "options": ["A", "B", "C", "D"], "answer": "...", "concept_hint": "..."}}
    """
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception(_is_retryable_error),
    )
    def _generate_clone():
        return client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
    
    try:
        response = _generate_clone()
        return json.loads(response.text)
    except Exception as e:
        puter_key = os.environ.get("PUTER_API_KEY")
        if puter_key:
            print("Gemini clone failed, falling back to Puter AI...", e)
            import openai
            puter_client = openai.OpenAI(api_key=puter_key, base_url="https://api.puter.com/puterai/openai/v1/")
            completion = puter_client.chat.completions.create(
                model="claude-3-5-sonnet",
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Puter models might return markdown blocks like ```json ... ```
            content = completion.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            return json.loads(content)
        else:
            raise e


def generate_flashcards(topic: str, count: int = 5):
    safe_count = max(1, min(count, 10))
    safe_topic = topic or "CAT Concepts"
    prompt = f"""
    You are an expert CAT exam tutor. Generate {safe_count} high-quality flashcards for the topic "{safe_topic}".
    Each flashcard must contain:
    - front: a short concept prompt, formula title, or recall question
    - back: the answer, formula, or compact explanation
    - explanation: why this matters for CAT preparation
    - topic: "{safe_topic}"

    Return ONLY valid JSON as an array:
    [
      {{"front": "...", "back": "...", "explanation": "...", "topic": "{safe_topic}"}}
    ]
    """

    try:
        client, _ = _get_clients()

        @retry(
            wait=wait_exponential(multiplier=2, min=4, max=60),
            stop=stop_after_attempt(5),
            retry=retry_if_exception(_is_retryable_error),
        )
        def _generate_flashcards():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

        response = _generate_flashcards()
        cards = json.loads(response.text)
        return _normalize_flashcards(cards, safe_topic, safe_count)
    except Exception as e:
        puter_key = os.environ.get("PUTER_API_KEY")
        if puter_key:
            try:
                print("Gemini flashcards failed, falling back to Puter AI...", e)
                import openai

                puter_client = openai.OpenAI(
                    api_key=puter_key,
                    base_url="https://api.puter.com/puterai/openai/v1/",
                )
                completion = puter_client.chat.completions.create(
                    model="claude-3-5-sonnet",
                    messages=[{"role": "user", "content": prompt}],
                )
                content = _strip_code_fences(completion.choices[0].message.content or "")
                cards = json.loads(content)
                return _normalize_flashcards(cards, safe_topic, safe_count)
            except Exception as puter_error:
                print("Puter flashcards failed, falling back to local flashcards...", puter_error)

        return _normalize_flashcards([], safe_topic, safe_count)
