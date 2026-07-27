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


--------------------------------
Feature 4: Tool Calling
--------------------------------

Initial tools:

- web request
- search


--------------------------------
Feature 5: Knowledge Base (RAG)
-------------------------------

User can:

- upload documents (txt, md, pdf)
- view chunked content
- bind knowledge bases to agents


--------------------------------
Out of Scope
--------------------------------

No:

payment
team
workflow
memory
multi-agent
subscription
