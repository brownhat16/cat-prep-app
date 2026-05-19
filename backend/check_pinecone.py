import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

try:
    api_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME")
    
    if not api_key or not index_name:
        print("Missing API key or Index Name in .env file.")
        exit(1)

    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    stats = index.describe_index_stats()
    
    print("SUCCESS: Successfully connected to Pinecone!")
    print(f"Index Name: {index_name}")
    print(f"Dimensions: {stats.get('dimension')}")
    print(f"Total Vectors: {stats.get('total_vector_count')}")
    
except Exception as e:
    print(f"FAILED: Could not connect to Pinecone. Error: {str(e)}")
