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
Out of Scope
--------------------------------

No:

auth
payment
team
workflow
memory
RAG
multi-agent
subscription