import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// MCP Client setup
let mcpClient = null
let mcpTools = []

// Initialize MCP connection
async function initializeMCP() {
  try {
    console.log('Connecting to n8n MCP server...')
    
    const mcpServerUrl = process.env.MCP_SERVER_URL
    if (!mcpServerUrl) {
      throw new Error('MCP_SERVER_URL environment variable not set')
    }
    
    console.log(`Connecting to MCP server: ${mcpServerUrl}`)
    
    // Create SSE transport for HTTP-based MCP server with SSL options
    const transport = new SSEClientTransport(
      new URL(mcpServerUrl),
      {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        // Handle self-signed certificates
        agent: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? undefined : {
          rejectUnauthorized: false
        }
      }
    )
    
    mcpClient = new Client(
      {
        name: 'marisa-voice-assistant',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    
    await mcpClient.connect(transport)
    console.log('Connected to n8n MCP server successfully')
    
    // Get available tools
    const toolsResponse = await mcpClient.listTools()
    mcpTools = toolsResponse.tools || []
    console.log(`Discovered ${mcpTools.length} MCP tools:`, mcpTools.map(t => t.name))
    
  } catch (error) {
    console.error('Failed to connect to MCP server:', error.message)
    console.log('MCP server will be unavailable, but voice assistant will continue to work')
    mcpClient = null
  }
}

// Initialize MCP on startup
initializeMCP()

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// MCP Tools endpoints
app.get('/api/mcp/tools', (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ 
        error: 'MCP client not connected',
        tools: []
      })
    }
    
    res.json({ 
      status: 'connected',
      tools: mcpTools,
      count: mcpTools.length
    })
  } catch (error) {
    console.error('Error getting MCP tools:', error)
    res.status(500).json({ error: 'Failed to get MCP tools' })
  }
})

app.post('/api/mcp/call-tool', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ 
        error: 'MCP client not connected'
      })
    }
    
    const { name, arguments: toolArgs } = req.body
    
    if (!name) {
      return res.status(400).json({ 
        error: 'Tool name is required'
      })
    }
    
    console.log(`Calling MCP tool: ${name}`, toolArgs)
    
    const result = await mcpClient.callTool({
      name,
      arguments: toolArgs || {}
    })
    
    console.log(`MCP tool result:`, result)
    
    res.json({
      success: true,
      tool: name,
      result: result
    })
    
  } catch (error) {
    console.error('Error calling MCP tool:', error)
    res.status(500).json({ 
      error: 'Failed to call MCP tool',
      details: error.message
    })
  }
})

// Session endpoint to mint ephemeral tokens for OpenAI Realtime API
app.post('/api/session', async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      })
    }

    // Create ephemeral session with OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy'
        })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API Error:', response.status, errorData)
      return res.status(response.status).json({ 
        error: 'Failed to create session with OpenAI',
        details: errorData
      })
    }

    const sessionData = await response.json()
    
    // Return the session data (includes ephemeral token)
    res.json(sessionData)
    
  } catch (error) {
    console.error('Session creation error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 JARVIS Backend Server running on port ${PORT}`)
  console.log(`📡 Health check: http://localhost:${PORT}/health`)
  console.log(`🔑 Session endpoint: http://localhost:${PORT}/api/session`)
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY environment variable not set!')
    console.warn('   Please create a .env file with your OpenAI API key')
  }
})