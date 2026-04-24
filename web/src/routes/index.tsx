import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '#/components/Chat'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Chat />
    </div>
  )
}
