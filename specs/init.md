# AI Agent Platform MVP

Goal:

Build the smallest usable AI agent platform.

Target:

Solo developer MVP.

Priorities:

speed > simplicity > scalability


--------------------------------
Feature 1: Chat
--------------------------------

User can:

- send message
- receive streaming response
- stop generation

Need:

- chat history
- loading state

Do NOT implement:

- image generation
- voice
- multi-user chat


--------------------------------
Feature 2: Agent Config
--------------------------------

User can:

- create agent
- edit system prompt
- choose model
- enable tools

Store:

name
prompt
model
enabled tools
knowledge bases

Do NOT implement:

permissions
sharing
templates


--------------------------------
Feature 3: Conversation History
--------------------------------

Need:

save:

conversation
messages
agent_id

User can:

view history

Do NOT implement:

search
folders
tags


--------------------------------
Feature 4: Tool Calling
--------------------------------

Initial tools:

- web request
- search

Do NOT implement:

MCP
plugin marketplace
workflow engine


--------------------------------
Feature 5: Knowledge Base (RAG)
-------------------------------

User can:

- upload documents (txt, md, pdf)
- view chunked content
- bind knowledge bases to agents

Do NOT implement:

- semantic search beyond vector similarity
- document-level permissions
- multi-format conversion

-------------------------------
Out of Scope
--------------------------------

No:

auth
payment
team
workflow
memory
multi-agent
subscription