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


def _get_puter_token() -> str:
    token = os.environ.get("PUTER_AUTH_TOKEN")
    if not token:
        raise RuntimeError("Puter backend fallback is not configured. Set PUTER_AUTH_TOKEN.")
    return token


def _generate_with_puter(prompt: str, model: str = "claude-3-5-sonnet") -> str:
    import openai

    puter_client = openai.OpenAI(
        api_key=_get_puter_token(),
        base_url="https://api.puter.com/puterai/openai/v1/",
    )
    completion = puter_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return _strip_code_fences(completion.choices[0].message.content or "")


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


def _fallback_clones(topic: str, difficulty: str, count: int):
    safe_topic = topic or "CAT"
    safe_difficulty = difficulty or "Medium"
    scenarios = [
        ("students", "solve", "problems", "second"),
        ("teams", "complete", "tasks", "third"),
        ("workers", "finish", "units", "first"),
        ("traders", "sell", "items", "second"),
        ("runners", "cover", "laps", "third"),
        ("buses", "carry", "passengers", "first"),
        ("pipes", "fill", "tanks", "second"),
        ("machines", "produce", "components", "third"),
        ("analysts", "review", "cases", "first"),
        ("shops", "earn", "orders", "second"),
    ]
    clones = []
    for index in range(max(1, count)):
        actor_plural, verb, unit, target_position = scenarios[index % len(scenarios)]
        ratio_a = 2 + (index % 3)
        ratio_b = 3 + (index % 4)
        ratio_c = 5 + (index % 5)
        total = (ratio_a + ratio_b + ratio_c) * (4 + index)
        target_share = {
            "first": ratio_a,
            "second": ratio_b,
            "third": ratio_c,
        }[target_position]
        part_value = total // (ratio_a + ratio_b + ratio_c)
        answer = str(target_share * part_value)
        clones.append(
            {
                "question_text": f"Three {actor_plural} {verb} {safe_topic.lower()} {unit} of {safe_difficulty.lower()} difficulty in the ratio {ratio_a}:{ratio_b}:{ratio_c}. If the total is {total}, how many {unit} does the {target_position} one handle?",
                "options": [
                    str(max(1, int(answer) - part_value)),
                    str(max(1, int(answer) - 1)),
                    answer,
                    str(int(answer) + part_value),
                ],
                "answer": answer,
                "concept_hint": "Convert the ratio into total parts, find one part, then multiply by the target share.",
            }
        )
    return clones


def _normalize_clone_item(clone, topic: str, difficulty: str):
    if not isinstance(clone, dict):
        return None
    question_text = str(clone.get("question_text", "")).strip()
    concept_hint = str(clone.get("concept_hint", "")).strip()
    answer = str(clone.get("answer", "")).strip()
    options = clone.get("options", [])
    if not isinstance(options, list):
        options = []
    normalized_options = [str(option).strip() for option in options if str(option).strip()]
    if len(normalized_options) != 4 or not question_text or not concept_hint or not answer:
        return None
    return {
        "question_text": question_text,
        "options": normalized_options,
        "answer": answer,
        "concept_hint": concept_hint,
    }


def _normalize_clone_batch(clones, topic: str, difficulty: str, count: int):
    normalized = []
    for clone in clones or []:
        normalized_clone = _normalize_clone_item(clone, topic, difficulty)
        if normalized_clone:
            normalized.append(normalized_clone)
        if len(normalized) >= max(1, count):
            break
    if normalized:
        return normalized
    return _fallback_clones(topic, difficulty, count)


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
    except Exception:
        content = _generate_with_puter(prompt)
        return json.loads(content)


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
    except Exception:
        try:
            content = _generate_with_puter(prompt)
            cards = json.loads(content)
            return _normalize_flashcards(cards, safe_topic, safe_count)
        except Exception:
            return _normalize_flashcards([], safe_topic, safe_count)


def generate_question_clones(topic: str, difficulty: str, count: int = 10):
    safe_count = max(1, min(count, 10))
    safe_topic = topic or "CAT"
    safe_difficulty = difficulty or "Medium"

    prompt = f"""
    You are an expert CAT exam setter. Generate {safe_count} NEW, high-quality multiple choice questions on {safe_topic} with {safe_difficulty} difficulty.
    Each question must:
    - test CAT-style logical reasoning or quantitative aptitude
    - include exactly 4 options
    - include the correct answer
    - include a short concept hint

    Return ONLY valid JSON as an array:
    [
      {{
        "question_text": "...",
        "options": ["A", "B", "C", "D"],
        "answer": "...",
        "concept_hint": "..."
      }}
    ]
    """

    try:
        client, _ = _get_clients()

        @retry(
            wait=wait_exponential(multiplier=2, min=4, max=60),
            stop=stop_after_attempt(5),
            retry=retry_if_exception(_is_retryable_error),
        )
        def _generate_clones():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

        response = _generate_clones()
        clones = json.loads(response.text)
        return {
            "clones": _normalize_clone_batch(clones, safe_topic, safe_difficulty, safe_count),
            "source": "gemini",
        }
    except Exception:
        try:
            content = _generate_with_puter(prompt)
            clones = json.loads(content)
            return {
                "clones": _normalize_clone_batch(clones, safe_topic, safe_difficulty, safe_count),
                "source": "puter",
            }
        except Exception:
            return {
                "clones": _fallback_clones(safe_topic, safe_difficulty, safe_count),
                "source": "local",
            }
