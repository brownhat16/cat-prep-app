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
    t_lower = safe_topic.lower()
    
    if "algebra" in t_lower:
        templates = [
            {
                "front": "Algebra: Quadratic Roots & Coefficients",
                "back": "For ax^2 + bx + c = 0, roots p & q satisfy: p+q = -b/a, pq = c/a.",
                "explanation": "Commonly tested in algebraic functions, series, and optimization setups.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "If the roots of the equation x^2 - px + q = 0 are consecutive integers, then what is p^2 - 4q?",
                    "options": ["A) 1", "B) 2", "C) 3", "D) 4"],
                    "answer": "A) 1",
                    "solution": "Let roots be n and n+1. Sum = n + n + 1 = 2n + 1 = p. Product = n(n+1) = q. Therefore, p^2 - 4q = (2n + 1)^2 - 4n(n+1) = 4n^2 + 4n + 1 - 4n^2 - 4n = 1. The correct option is A."
                }
            },
            {
                "front": "Algebra: Difference of Squares & Sums",
                "back": "(a - b)(a + b) = a^2 - b^2, and (a + b + c)^2 = a^2 + b^2 + c^2 + 2(ab + bc + ca).",
                "explanation": "Used to simplify quadratic equations and find constraints in variable systems.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "If a + b + c = 6 and ab + bc + ca = 11, what is the value of a^2 + b^2 + c^2?",
                    "options": ["A) 14", "B) 16", "C) 18", "D) 20"],
                    "answer": "A) 14",
                    "solution": "Using the identity: (a+b+c)^2 = a^2+b^2+c^2 + 2(ab+bc+ca) => 6^2 = a^2+b^2+c^2 + 2(11) => 36 = a^2+b^2+c^2 + 22 => a^2+b^2+c^2 = 14. Correct option is A."
                }
            }
        ]
    elif "geometry" in t_lower:
        templates = [
            {
                "front": "Geometry: Apollonius' Theorem",
                "back": "AB^2 + AC^2 = 2 * (AD^2 + BD^2) where AD is the median to side BC.",
                "explanation": "Extremely useful in finding median lengths of a triangle directly without trigs.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "In a triangle ABC, AB = 6, AC = 8, and BC = 10. Find the length of the median AD to the side BC.",
                    "options": ["A) 4", "B) 5", "C) 6", "D) 7"],
                    "answer": "B) 5",
                    "solution": "By Apollonius' theorem: AB^2 + AC^2 = 2(AD^2 + BD^2) => 36 + 64 = 2(AD^2 + 5^2) => 100 = 2(AD^2 + 25) => 50 = AD^2 + 25 => AD^2 = 25 => AD = 5. Correct option is B."
                }
            }
        ]
    elif "probability" in t_lower:
        templates = [
            {
                "front": "Probability: Complementary Counting",
                "back": "P(At least one) = 1 - P(None)",
                "explanation": "Always use complement counting when 'at least' or 'at most' triggers complex multi-case combinations.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "A fair coin is tossed 5 times. What is the probability of getting at least one head?",
                    "options": ["A) 1/32", "B) 31/32", "C) 15/16", "D) 7/8"],
                    "answer": "B) 31/32",
                    "solution": "P(At least one head) = 1 - P(No heads). The only way to get no heads is to get all tails (T-T-T-T-T), which has a probability of (1/2)^5 = 1/32. Thus, 1 - 1/32 = 31/32. Correct option is B."
                }
            }
        ]
    elif "number" in t_lower:
        templates = [
            {
                "front": "Number Systems: Euler's Totient Theorem",
                "back": "If a and n are co-prime, then a^phi(n) mod n = 1.",
                "explanation": "Crucial for finding remainders of extremely large exponential terms.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "Find the remainder when 3^100 is divided by 7.",
                    "options": ["A) 1", "B) 2", "C) 4", "D) 6"],
                    "answer": "C) 4",
                    "solution": "phi(7) = 6. 3^6 mod 7 = 1. We write 100 = 6 * 16 + 4. Thus, 3^100 mod 7 = (3^6)^16 * 3^4 mod 7 = 1 * 81 mod 7 = 4. Correct option is C."
                }
            }
        ]
    elif "permutation" in t_lower or "combinations" in t_lower:
        templates = [
            {
                "front": "P&C: Circular Arrangements",
                "back": "Number of ways to arrange n distinct objects around a circular table is (n - 1)!",
                "explanation": "If clockwise and counter-clockwise are identical, it is (n - 1)! / 2.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "In how many ways can 6 people be seated around a circular table such that two particular people are never seated together?",
                    "options": ["A) 120", "B) 72", "C) 48", "D) 24"],
                    "answer": "B) 72",
                    "solution": "Total seating = 5! = 120. Seating where two particular people are together = 4! * 2! = 48. Never together = 120 - 48 = 72 ways. Correct option is B."
                }
            }
        ]
    elif "time" in t_lower or "work" in t_lower:
        templates = [
            {
                "front": "Time & Work: Efficiency Ratio Rule",
                "back": "Ratio of efficiency of A to B is E_a : E_b = D_b : D_a.",
                "explanation": "Solve work problems instantly by establishing a 'Total Work Units' as the LCM of days.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": "A is 60% more efficient than B. If B alone can complete a work in 26 days, in how many days can A and B working together complete the same work?",
                    "options": ["A) 9 days", "B) 10 days", "C) 12 days", "D) 15 days"],
                    "answer": "B) 10 days",
                    "solution": "Let B's efficiency be 10 units/day. Then A's efficiency is 16 units/day. Total work = 26 * 10 = 260 units. Combined efficiency = 26 units/day. Time taken together = 260 / 26 = 10 days. Correct option is B."
                }
            }
        ]
    else:
        templates = [
            {
                "front": f"{safe_topic}: Core Principle",
                "back": "State the main constraint and active formula required.",
                "explanation": "Essential concept required for quick solving.",
                "topic": safe_topic,
                "practice_question": {
                    "question_text": f"Solve for f(x) under the {safe_topic} standard assumptions where inputs are prime integers.",
                    "options": ["A) 0", "B) 1", "C) Prime only", "D) Undefined"],
                    "answer": "B) 1",
                    "solution": "Standard identity holds f(x) = 1 under default prime domain assumptions. Correct option is B."
                }
            }
        ]

    # Duplicate or trim to match count
    while len(templates) < count:
        templates.append(templates[0].copy())
    return templates[:count]


def _fallback_clones(topic: str, difficulty: str, count: int, excluded_questions: list[str] | None = None):
    safe_topic = topic or "CAT"
    safe_difficulty = difficulty or "Medium"
    excluded = set(excluded_questions or [])
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
    index = 0
    while len(clones) < max(1, count) and index < 100:
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
        question_text = f"Three {actor_plural} {verb} {safe_topic.lower()} {unit} of {safe_difficulty.lower()} difficulty in the ratio {ratio_a}:{ratio_b}:{ratio_c}. If the total is {total}, how many {unit} does the {target_position} one handle?"
        if question_text not in excluded:
            clones.append(
                {
                    "question_text": question_text,
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
            excluded.add(question_text)
        index += 1
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


def _normalize_clone_batch(clones, topic: str, difficulty: str, count: int, excluded_questions: list[str] | None = None):
    normalized = []
    excluded = set(excluded_questions or [])
    for clone in clones or []:
        normalized_clone = _normalize_clone_item(clone, topic, difficulty)
        if normalized_clone and normalized_clone["question_text"] not in excluded:
            normalized.append(normalized_clone)
            excluded.add(normalized_clone["question_text"])
        if len(normalized) >= max(1, count):
            break
    if normalized:
        return normalized
    return _fallback_clones(topic, difficulty, count, excluded_questions)


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
        
        practice_q = card.get("practice_question")
        normalized_q = None
        if isinstance(practice_q, dict):
            normalized_q = {
                "question_text": str(practice_q.get("question_text") or "").strip(),
                "options": [str(opt).strip() for opt in practice_q.get("options") or [] if str(opt).strip()],
                "answer": str(practice_q.get("answer") or "").strip(),
                "solution": str(practice_q.get("solution") or "").strip()
            }
            if not normalized_q["question_text"] or len(normalized_q["options"]) < 2:
                normalized_q = None

        normalized.append(
            {
                "id": str(uuid.uuid4()),
                "front": front,
                "back": back,
                "explanation": explanation,
                "topic": str(card.get("topic") or safe_topic),
                "practice_question": normalized_q
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
    
    # RAG Integration: Retrieve custom uploaded formula/concept references from Pinecone
    context = ""
    try:
        client, pc = _get_clients()
        query_text = f"{safe_topic} formula concept rule CAT"
        
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
            top_k=5,
            include_metadata=True
        )
        
        if search_results and 'matches' in search_results:
            for match in search_results['matches']:
                meta = match.get('metadata', {})
                q_text = meta.get('question_text')
                hint_text = meta.get('concept_hint')
                if q_text or hint_text:
                    context += f"Concept/Formula reference:\n{q_text or ''}\nExplanation/Use: {hint_text or ''}\n\n"
    except Exception as exc:
        print(f"RAG query failed for flashcards, using default zero-shot generation: {exc}", flush=True)

    prompt = f"""
    You are an expert CAT exam tutor. Generate {safe_count} high-quality flashcards for the topic "{safe_topic}".
    Each flashcard must contain:
    - front: a short concept prompt, formula title, or recall question
    - back: the answer, formula, or compact explanation
    - explanation: why this matters for CAT preparation
    - topic: "{safe_topic}"
    - practice_question: a challenging, high-level CAT exam style multiple choice question testing this concept. It must be an object with:
        * question_text: "..." (detailed problem statement)
        * options: ["Option A", "Option B", "Option C", "Option D"] (4 choices)
        * answer: "..." (matching the correct option text exactly)
        * solution: "..." (step-by-step mathematical breakdown)

    Additional reference concepts extracted from user's uploaded formula guides (use these to make highly tailored, custom cards matching the uploaded formulas):
    {context}

    Return ONLY valid JSON as an array:
    [
      {{
        "front": "...",
        "back": "...",
        "explanation": "...",
        "topic": "{safe_topic}",
        "practice_question": {{
          "question_text": "...",
          "options": ["...", "...", "...", "..."],
          "answer": "...",
          "solution": "..."
        }}
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


def generate_question_clones(topic: str, difficulty: str, count: int = 10, excluded_questions: list[str] | None = None):
    safe_count = max(1, min(count, 10))
    safe_topic = topic or "CAT"
    safe_difficulty = difficulty or "Medium"

    excluded_prompt = ""
    if excluded_questions:
        excluded_preview = "\n".join(f"- {question}" for question in excluded_questions[:50])
        excluded_prompt = f"""
    Do not repeat any question that is semantically the same as these already-served questions:
    {excluded_preview}
    """

    prompt = f"""
    You are an expert CAT exam setter. Generate {safe_count} NEW, high-quality multiple choice questions on {safe_topic} with {safe_difficulty} difficulty.
    Each question must:
    - test CAT-style logical reasoning or quantitative aptitude
    - include exactly 4 options
    - include the correct answer
    - include a short concept hint
    - be unique and not overlap with previously served questions
    {excluded_prompt}

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
            "clones": _normalize_clone_batch(clones, safe_topic, safe_difficulty, safe_count, excluded_questions),
            "source": "gemini",
        }
    except Exception:
        try:
            content = _generate_with_puter(prompt)
            clones = json.loads(content)
            return {
                "clones": _normalize_clone_batch(clones, safe_topic, safe_difficulty, safe_count, excluded_questions),
                "source": "puter",
            }
        except Exception:
            return {
                "clones": _fallback_clones(safe_topic, safe_difficulty, safe_count, excluded_questions),
                "source": "local",
            }
