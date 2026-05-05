# Vector Store Decision

## Architecture Choice: In-Memory Simple Vector Store

For this Agentic PDF RAG application, we have chosen to implement a **Simple In-Memory Vector Store** over a dedicated external vector database (such as FAISS, ChromaDB, or Pinecone). 

Here is the rationale behind this architectural decision, mapped to our specific functional requirements:

### 1. Scale and Throughput
- **Our Requirement:** The application is designed to ingest a sample set of NDA documents (e.g., 20-50 PDFs) and perform localized retrieval and answering. 
- **Why In-Memory:** An in-memory store using exact k-Nearest Neighbors (k-NN) with cosine similarity calculates distances extremely fast for datasets of this size (typically well under 10,000 chunks). The overhead of querying a small array in memory is just a few milliseconds—often faster than the network latency required to ping a standalone vector database.

### 2. Operational Simplicity
- **Our Requirement:** The project needs to be self-contained, easy to build, and require minimal external infrastructure (besides the Generative AI API).
- **Why In-Memory:** Integrating a system like ChromaDB or Milvus adds significant operational complexity, requiring either a separate Docker container, a managed cloud service, or native bindings that complicate deployment in serverless environments. A simple array-based store is just TypeScript code, ensuring the application runs perfectly out-of-the-box.

### 3. Functional Requirements Fulfillment
The requirements specify:
- *Implement semantic or hybrid retrieval over the document chunks.*
- *Return the top retrieved chunks with a rank or score.*
- *Make it possible to inspect which chunks were used for the final answer.*

Our simple custom store perfectly fulfills these needs by calculating semantic cosine similarity between the query embedding and chunk embeddings, naturally returning sorted (ranked) items with their raw scores, document IDs, and full metadata attached.

### Trade-offs
1. **Persistence:** An in-memory store does not persist across server restarts out-of-the-box. In a production system requiring millions of documents, durability is necessary. However, since the goal here is to demonstrate ingestion, chunking, and self-correcting RAG traces, re-ingesting the sample set dynamically is acceptable and keeps the state clean.
2. **Memory Limits:** Scaling to hundreds of thousands of documents would consume too much RAM and slow down exact nearest-neighbor search. If this application were to index a massive enterprise repository, migrating to a dedicated Approximate Nearest Neighbor (ANN) database (like FAISS or Pinecone) would become necessary.

### Conclusion
For a prototype or bounded-context application like this one, an in-memory vector store is **more than enough**. It strictly solves the problem with zero operational bloat, allows us to build powerful self-correcting retrieval logic, and maintains lightning-fast response times.
