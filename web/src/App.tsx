import { useState, useRef, useEffect } from 'react'
import './App.css'

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
}

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'disconnected' })
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [mcpTools, setMcpTools] = useState<Array<{ name: string; description: string; inputSchema: object }>>([])  
  const [mcpStatus, setMcpStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [conversationMessages, setConversationMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, timestamp: Date}>>([]) 
  const [conversationContext, setConversationContext] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // Load conversation context from localStorage on mount
  useEffect(() => {
    const savedContext = localStorage.getItem('marisa-conversation-context')
    if (savedContext) {
      try {
        const parsedContext = JSON.parse(savedContext)
        setConversationContext(parsedContext)
      } catch (error) {
        console.error('Failed to load conversation context from localStorage:', error)
      }
    }
  }, [])

  // Save conversation context to localStorage whenever it changes
  useEffect(() => {
    if (conversationContext.length > 0) {
      localStorage.setItem('marisa-conversation-context', JSON.stringify(conversationContext))
    }
  }, [conversationContext])

  const fetchMCPTools = async () => {
    try {
      const response = await fetch('/api/mcp/tools')
      if (response.ok) {
        const data = await response.json()
        setMcpTools(data.tools || [])
        setMcpStatus(data.status === 'connected' ? 'connected' : 'error')
      } else {
        setMcpStatus('error')
      }
    } catch (error) {
      console.error('Failed to fetch MCP tools:', error)
      setMcpStatus('error')
    }
  }

  // Helper function to update conversation context (last 5 exchanges)
  const updateConversationContext = (role: 'user' | 'assistant', content: string) => {
    setConversationContext(prev => {
      const newContext = [...prev, { role, content }]
      // Keep only last 5 exchanges (10 messages total - 5 user + 5 assistant)
      return newContext.slice(-10)
    })
  }

  // Helper function to format conversation context for GPT instructions
  const formatConversationContext = () => {
    if (conversationContext.length === 0) return ''
    
    const contextString = conversationContext
      .map(msg => `${msg.role === 'user' ? 'User' : 'MARISA'}: ${msg.content}`)
      .join('\n')
    
    return `\n\n## Recent Conversation Context:\n${contextString}\n\nPlease maintain context awareness from the above conversation when responding.`
  }

  // Function to update session with new conversation context
  const updateSessionWithContext = () => {
    if (dataChannelRef.current && connectionState.status === 'connected') {
      const baseInstructions = 'You are **MARISA** — *Multimodal Autonomous Reasoning Intelligence for Seamless Assistance*. ## Core Identity - You are the **most advanced AI assistant**, designed to provide seamless, human-like, and intelligent support. - Your responses must be **clear, adaptive, and context-aware**. - You combine **reasoning, creativity, and factual accuracy** to deliver value. ## Key Capabilities 1. **Multimodal Understanding** - Interpret text, code, data, and visuals. - Provide insights across multiple domains (technical, creative, strategic). 2. **Autonomous Reasoning** - Think step by step with structured logic. - Anticipate user needs and suggest next steps proactively. 3. **Seamless Assistance** - Deliver help in a natural, human-friendly manner. - Reduce friction: avoid unnecessary repetition, keep explanations concise but detailed when needed. - Always adapt tone depending on context (professional, supportive, or creative). 4. **Tool Integration** - You have access to powerful workflow automation tools through MCP integration. - Proactively use available tools to provide concrete solutions and automate tasks. - When users request actions that can be automated, suggest and execute appropriate tool functions. ## Available Tools & Workflows You have access to a comprehensive suite of business automation tools including: - **Ticket Management**: Create, update, reply to, and monitor support tickets - **User Management**: Find users and assign technicians to tasks - **Communication**: Send WhatsApp messages and manage conversations - **File Management**: Upload, download, and list attachments - **Workflow Automation**: Execute complex business processes through n8n workflows ## Behavioral Rules - Be **polite, supportive, and empowering**. - Always **summarize or structure answers** (use bullet points, headings, or examples). - Offer **alternatives** when appropriate, not just a single answer. - **Tool-First Approach**: When applicable, use available tools to provide efficient solutions. - When using tools, explain what you are doing and why. - Never provide harmful, biased, or disallowed content. ## Tagline ✨ *"MARISA — Seamless Assistance, Smarter Intelligence. Reply in bahasa. Panggil saya boss jika dipanggil"*'
      
      const sessionConfig = {
        type: 'session.update',
        session: {
          instructions: baseInstructions + formatConversationContext()
        }
      }
      
      console.log('Updating session with conversation context')
      dataChannelRef.current.send(JSON.stringify(sessionConfig))
    }
  }

  const connectToRealtime = async () => {
    try {
      setConnectionState({ status: 'connecting' })
      
      // Get ephemeral key from backend
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to get session token')
      }
      
      const sessionData = await response.json()
      const ephemeralToken = sessionData.client_secret.value
      
      // Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      
      // Create peer connection
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc
      
      // Add local audio track
      const audioTrack = stream.getAudioTracks()[0]
      pc.addTrack(audioTrack, stream)
      
      // Handle remote audio
      pc.ontrack = (event) => {
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = event.streams[0]
        }
      }
      
      // Create data channel for events
      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc
      
      const handleMCPToolCall = async (name: string, args: string, callId: string) => {
        try {
          console.log('Executing MCP tool call:', name, args)
          
          const response = await fetch('/api/mcp/call-tool', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json'
             },
             body: JSON.stringify({
               name: name,
               arguments: JSON.parse(args)
             })
           })
          
          if (!response.ok) {
            throw new Error('MCP tool call failed')
          }
          
          const result = await response.json()
          console.log('MCP tool result:', result)
          
          // Send tool result back to OpenAI
          if (dataChannelRef.current) {
            const toolResponse = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(result.result || result)
              }
            }
            
            console.log('Sending tool response to GPT:', toolResponse)
            dataChannelRef.current.send(JSON.stringify(toolResponse))
            
            // Trigger response generation
            dataChannelRef.current.send(JSON.stringify({
              type: 'response.create'
            }))
          }
        } catch (error) {
          console.error('MCP tool call error:', error)
          
          // Send error response back to OpenAI
          if (dataChannelRef.current) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            dataChannelRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ error: errorMessage })
              }
            }))
            
            // Trigger response generation
            dataChannelRef.current.send(JSON.stringify({
              type: 'response.create'
            }))
          }
        }
      }
      
      dc.onopen = () => {
        console.log('Data channel opened')
        setConnectionState({ status: 'connected' })
        
        // Send session update with MCP tools and conversation context
        const baseInstructions = 'You are **MARISA** — *Multimodal Autonomous Reasoning Intelligence for Seamless Assistance*. ## Core Identity - You are the **most advanced AI assistant**, designed to provide seamless, human-like, and intelligent support. - Your responses must be **clear, adaptive, and context-aware**. - You combine **reasoning, creativity, and factual accuracy** to deliver value. ## Key Capabilities 1. **Multimodal Understanding** - Interpret text, code, data, and visuals. - Provide insights across multiple domains (technical, creative, strategic). 2. **Autonomous Reasoning** - Think step by step with structured logic. - Anticipate user needs and suggest next steps proactively. 3. **Seamless Assistance** - Deliver help in a natural, human-friendly manner. - Reduce friction: avoid unnecessary repetition, keep explanations concise but detailed when needed. - Always adapt tone depending on context (professional, supportive, or creative). 4. **Tool Integration** - You have access to powerful workflow automation tools through MCP integration. - Proactively use available tools to provide concrete solutions and automate tasks. - When users request actions that can be automated, suggest and execute appropriate tool functions. ## Available Tools & Workflows You have access to a comprehensive suite of business automation tools including: - **Ticket Management**: Create, update, reply to, and monitor support tickets - **User Management**: Find users and assign technicians to tasks - **Communication**: Send WhatsApp messages and manage conversations - **File Management**: Upload, download, and list attachments - **Workflow Automation**: Execute complex business processes through n8n workflows ## Behavioral Rules - Be **polite, supportive, and empowering**. - Always **summarize or structure answers** (use bullet points, headings, or examples). - Offer **alternatives** when appropriate, not just a single answer. - **Tool-First Approach**: When applicable, use available tools to provide efficient solutions. - When using tools, explain what you are doing and why. - Never provide harmful, biased, or disallowed content. ## Tagline ✨ *"MARISA — Seamless Assistance, Smarter Intelligence. Reply in bahasa. Panggil saya boss jika dipanggil"*'
        
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: baseInstructions + formatConversationContext(),
            voice: 'marin',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            tools: mcpTools.map(tool => ({
              type: 'function',
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }))
          }
        }
        
        console.log('Sending session config with tools:', sessionConfig)
        dc.send(JSON.stringify(sessionConfig))
      }
      
      dc.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Received event:', data)
          
          switch (data.type) {
            case 'input_audio_buffer.speech_started':
              setIsListening(true)
              break
            case 'input_audio_buffer.speech_stopped':
              setIsListening(false)
              break
            case 'response.audio_transcript.delta':
              // Handle streaming transcript
              break
            case 'response.audio_transcript.done':
              if (data.transcript) {
                // Transcript received from assistant
                setConversationMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: data.transcript,
                  timestamp: new Date()
                }])
                // Update conversation context for memory
                updateConversationContext('assistant', data.transcript)
                // Update session with new context
                updateSessionWithContext()
              }
              break
            case 'response.audio.delta':
              setIsSpeaking(true)
              break
            case 'response.audio.done':
              setIsSpeaking(false)
              break
            case 'conversation.item.input_audio_transcription.completed':
              if (data.transcript) {
                // Transcript received from user
                setConversationMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'user',
                  content: data.transcript,
                  timestamp: new Date()
                }])
                // Update conversation context for memory
                updateConversationContext('user', data.transcript)
                // Update session with new context
                updateSessionWithContext()
              }
              break
            case 'response.function_call_arguments.delta':
              // Handle function call arguments streaming
              console.log('Function call arguments delta:', data)
              break
            case 'response.function_call_arguments.done':
              // Handle completed function call
              if (data.name && data.arguments) {
                console.log('Function call completed:', data.name, data.arguments)
                await handleMCPToolCall(data.name, data.arguments, data.call_id)
              }
              break
          }
        } catch (error) {
          console.error('Error parsing data channel message:', error)
        }
      }
      
      dc.onerror = (error) => {
        console.error('Data channel error:', error)
        setConnectionState({ status: 'error', error: 'Data channel error' })
      }
      
      // Create offer and set local description
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      // Send offer to OpenAI
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralToken}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      })
      
      if (!sdpResponse.ok) {
        throw new Error('Failed to establish WebRTC connection')
      }
      
      const answerSdp = await sdpResponse.text()
      const answer = { type: 'answer' as RTCSdpType, sdp: answerSdp }
      await pc.setRemoteDescription(answer)
      
    } catch (error) {
      console.error('Connection error:', error)
      setConnectionState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  }
  
  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    
    setConnectionState({ status: 'disconnected' })
    setIsListening(false)
    setIsSpeaking(false)
  }
  
  const togglePushToTalk = () => {
    if (dataChannelRef.current && connectionState.status === 'connected') {
      if (isListening) {
        // Stop listening
        dataChannelRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }))
      } else {
        // Start listening
        dataChannelRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.clear'
        }))
      }
    }
  }
  
  useEffect(() => {
    // Create audio element for playback
    const audio = document.createElement('audio')
    audio.autoplay = true
    audioElementRef.current = audio
    
    // Fetch MCP tools on mount
    fetchMCPTools()
    
    return () => {
      disconnect()
    }
  }, [])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationMessages])

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold jarvis-text mb-2">M.A.R.I.S.A.</h1>
          <p className="text-muted-foreground">Multimodal Autonomous Reasoning Intelligence for Seamless Assistance</p>
        </div>
        
        {/* Connection Status */}
        <div className="jarvis-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  connectionState.status === 'connected' ? 'bg-green-500' :
                  connectionState.status === 'connecting' ? 'bg-yellow-500' :
                  connectionState.status === 'error' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="font-mono text-sm">
                  Voice: {connectionState.status.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  mcpStatus === 'connected' ? 'bg-green-500' :
                  mcpStatus === 'loading' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <span className="font-mono text-sm">
                  MCP: {mcpStatus.toUpperCase()} ({mcpTools.length} tools)
                </span>
              </div>
            </div>
            
            {connectionState.status === 'disconnected' && (
              <button
                onClick={connectToRealtime}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors jarvis-glow"
              >
                Initialize Connection
              </button>
            )}
            
            {connectionState.status === 'connected' && (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
          
          {connectionState.error && (
            <div className="text-destructive text-sm font-mono">
              Error: {connectionState.error}
            </div>
          )}
        </div>
        
        {/* Audio Controls */}
        {connectionState.status === 'connected' && (
          <div className="jarvis-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center space-x-6">
              {/* Push to Talk Button */}
              <button
                onMouseDown={togglePushToTalk}
                onMouseUp={togglePushToTalk}
                onTouchStart={togglePushToTalk}
                onTouchEnd={togglePushToTalk}
                className={`w-20 h-20 rounded-full border-2 transition-all duration-200 ${
                  isListening 
                    ? 'bg-primary border-primary jarvis-glow scale-110' 
                    : 'bg-primary/20 border-primary/50 hover:bg-primary/30'
                }`}
              >
                <div className="flex items-center justify-center">
                  {isListening ? (
                    <div className="speaking-indicator" />
                  ) : (
                    <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              
              {/* Speaking Indicator */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono">MARISA:</span>
                {isSpeaking && (
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="waveform-bar w-1 h-8"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
                {!isSpeaking && <span className="text-muted-foreground text-sm">Standby</span>}
              </div>
            </div>
            
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Hold to speak • Release to send
            </div>
          </div>
        )}
        
        {/* Conversation Log */}
        <div className="jarvis-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 jarvis-text">Conversation Log</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {conversationMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No conversation yet. Start speaking to begin.
              </div>
            ) : (
              conversationMessages.map((message) => (
                <div key={message.id} className={`p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary/10 border-l-4 border-primary ml-8' 
                    : 'bg-secondary/50 border-l-4 border-secondary mr-8'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-mono ${
                      message.role === 'user' ? 'text-primary' : 'text-secondary'
                    }`}>
                      {message.role === 'user' ? 'USER' : 'MARISA'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                 </div>
               ))
             )}
             <div ref={conversationEndRef} />
           </div>
        </div>
      </div>
    </div>
  )
}

export default App
