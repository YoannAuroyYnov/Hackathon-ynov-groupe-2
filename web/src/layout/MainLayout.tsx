import { CssBaseline, ThemeProvider } from '@mui/material'
import { theme } from '#/theme'
import { ChatLayout } from './ChatLayout'
import { SidebarLayout } from './SidebarLayout'

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="flex h-screen overflow-hidden">
        <SidebarLayout />
        <div className="flex-1 min-w-0">
          <ChatLayout>{children}</ChatLayout>
        </div>
      </div>
    </ThemeProvider>
  )
}
