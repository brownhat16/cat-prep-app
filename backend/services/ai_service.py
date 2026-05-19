import os
from google import genai
from pinecone import Pinecone

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

async def generate_question_clone(topic: str, difficulty: str):
    client, pc = _get_clients()

    # Step 1: Embed the query to find similar questions in Pinecone
    query_text = f"{topic} CAT question {difficulty} difficulty"
    
    embed_response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=query_text,
        config=genai.types.EmbedContentConfig(output_dimensionality=768)
    )
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
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
        )
    )
    
    import json
    return json.loads(response.text)
