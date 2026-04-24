export const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-full py-6 min-h-0 flex flex-col">
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
