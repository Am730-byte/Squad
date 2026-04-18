'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'

interface Point {
  x: number
  y: number
}

interface DrawEvent {
  type: 'path' | 'clear' | 'undo'
  data: {
    points?: Point[]
    color?: string
    width?: number
  }
}

interface WhiteboardEvent {
  userId: string
  timestamp: number
  event: DrawEvent
}

interface WhiteboardPanelProps {
  socket: Socket | null
  workspaceId: string
  currentUserId: string
}

export default function WhiteboardPanel({
  socket,
  workspaceId,
  currentUserId,
}: WhiteboardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const currentPath = useRef<Point[]>([])

  const [color, setColor] = useState('#ffffff')
  const [lineWidth, setLineWidth] = useState(3)

  // Get canvas 2D context helper
  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  // Draw a path on the canvas using the provided points, color, and width
  const drawPath = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      points: Point[],
      strokeColor: string,
      strokeWidth: number
    ) => {
      if (points.length < 2) return
      ctx.save()
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    },
    []
  )

  // Apply a remote draw event to the canvas
  const applyRemoteDrawEvent = useCallback(
    (drawEvent: DrawEvent) => {
      const ctx = getCtx()
      if (!ctx) return

      if (drawEvent.type === 'path') {
        const { points, color: c, width: w } = drawEvent.data
        if (points && points.length >= 2) {
          drawPath(ctx, points, c ?? '#ffffff', w ?? 3)
        }
      } else if (drawEvent.type === 'clear') {
        const canvas = canvasRef.current
        if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
      } else if (drawEvent.type === 'undo') {
        // Simplified undo: clear the entire canvas
        const canvas = canvasRef.current
        if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
    [getCtx, drawPath]
  )

  // Resize canvas to fill its container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement
      if (!parent) return
      // Preserve drawing by saving to image before resize
      const ctx = canvas.getContext('2d')
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      if (imageData && ctx) {
        ctx.putImageData(imageData, 0, 0)
      }
    })

    const parent = canvas.parentElement
    if (parent) {
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      resizeObserver.observe(parent)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    const handleWhiteboardDraw = (whiteboardEvent: WhiteboardEvent) => {
      // Ignore events from ourselves (already drawn locally)
      if (whiteboardEvent.userId === currentUserId) return
      applyRemoteDrawEvent(whiteboardEvent.event)
    }

    socket.on('whiteboard:draw', handleWhiteboardDraw)

    return () => {
      socket.off('whiteboard:draw', handleWhiteboardDraw)
    }
  }, [socket, currentUserId, applyRemoteDrawEvent])

  // Get mouse position relative to canvas
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const point = getCanvasPoint(e)
    currentPath.current = [point]

    const ctx = getCtx()
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return

    const point = getCanvasPoint(e)
    currentPath.current.push(point)

    const ctx = getCtx()
    if (!ctx) return

    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const endDrawing = () => {
    if (!isDrawing.current) return
    isDrawing.current = false

    const path = currentPath.current
    currentPath.current = []

    if (path.length >= 2 && socket) {
      socket.emit('whiteboard:draw', {
        type: 'path',
        data: {
          points: path,
          color,
          width: lineWidth,
        },
      })
    }
  }

  const handleClear = () => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    if (socket) {
      socket.emit('whiteboard:draw', {
        type: 'clear',
        data: {},
      })
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700 flex-shrink-0 bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mr-2">
          Whiteboard
        </h2>

        {/* Color picker */}
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <span>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-600 bg-transparent p-0.5"
            aria-label="Stroke color"
          />
        </label>

        {/* Line width slider */}
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <span>Width</span>
          <input
            type="range"
            min={1}
            max={20}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24 accent-indigo-500"
            aria-label="Line width"
          />
          <span className="w-4 text-center">{lineWidth}</span>
        </label>

        {/* Clear button */}
        <button
          onClick={handleClear}
          className="ml-auto px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
          aria-label="Clear whiteboard"
        >
          Clear
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          className="absolute inset-0 cursor-crosshair"
          aria-label="Collaborative whiteboard canvas"
        />
      </div>
    </div>
  )
}
