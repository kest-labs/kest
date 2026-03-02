import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Folder,
  TestTube2,
  Database,
  Users,
  Settings,
  LogOut,
  Bell,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/auth-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { kestApi } from '@/services/kest-api.service'
import {
  getPendingMemberInvitations,
  removePendingMemberInvitation,
  type PendingMemberInvitation,
} from '@/utils/member-invitations'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, clearAuth } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingInvitations, setPendingInvitations] = useState<PendingMemberInvitation[]>([])
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null)

  const currentProjectId = location.pathname.match(/^\/projects\/(\d+)/)?.[1]
  const projectBase = currentProjectId ? `/projects/${currentProjectId}` : '/projects'

  useEffect(() => {
    setPendingInvitations(getPendingMemberInvitations())
  }, [])

  useEffect(() => {
    setPendingInvitations(getPendingMemberInvitations())
  }, [location.pathname, location.search])

  const menuItems = [
    {
      title: 'Dashboard',
      items: [
        { title: 'Home', icon: Home, url: '/' },
      ],
    },
    {
      title: 'Projects',
      items: [
        { title: 'All Projects', icon: Folder, url: '/projects' },
        ...(currentProjectId
          ? [
              { title: 'Use Cases', icon: TestTube2, url: `${projectBase}?view=test-cases` },
              { title: 'Environments', icon: Database, url: `${projectBase}?view=environments` },
              { title: 'Members', icon: Users, url: `${projectBase}?view=members` },
            ]
          : []),
      ],
    },
    {
      title: 'Account',
      items: [
        { title: 'Settings', icon: Settings, url: '/settings' },
      ],
    },
  ]

  const handleLogout = () => {
    clearAuth()
    window.location.href = '/'
  }

  const handleAcceptInvitation = async (invitation: PendingMemberInvitation) => {
    const key = `${invitation.projectId}:${invitation.token}`
    setProcessingInvitation(key)
    try {
      await kestApi.member.acceptInvitation(invitation.projectId, { token: invitation.token })
      setPendingInvitations(removePendingMemberInvitation(invitation.projectId, invitation.token))
      toast.success('Invitation accepted')
      navigate(`/projects/${invitation.projectId}?view=members`)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to accept invitation')
    } finally {
      setProcessingInvitation(null)
    }
  }

  const handleDeclineInvitation = async (invitation: PendingMemberInvitation) => {
    const key = `${invitation.projectId}:${invitation.token}`
    setProcessingInvitation(key)
    try {
      await kestApi.member.declineInvitation(invitation.projectId, { token: invitation.token })
      setPendingInvitations(removePendingMemberInvitation(invitation.projectId, invitation.token))
      toast.success('Invitation declined')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to decline invitation')
    } finally {
      setProcessingInvitation(null)
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex flex-col">
        <div className="flex min-h-0 flex-1 w-full">
          <Sidebar>
            <SidebarHeader className="border-b px-6 py-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                  K
                </div>
                <span className="text-xl font-bold">Kest</span>
              </Link>
            </SidebarHeader>

            <SidebarContent>
              {menuItems.map((group) => (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <Link to={item.url}>
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>

          </Sidebar>

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex-1">
                <h1 className="text-lg font-semibold">Kest Platform</h1>
              </div>
              {user ? (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative">
                        <Bell className="w-4 h-4" />
                        {pendingInvitations.length > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                            {pendingInvitations.length}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel>Pending Invitations</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {pendingInvitations.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-foreground">No pending invitations</div>
                      ) : (
                        pendingInvitations.map((item) => {
                          const key = `${item.projectId}:${item.token}`
                          const isProcessing = processingInvitation === key
                          return (
                            <div key={key} className="px-2 py-2 border-b last:border-b-0">
                              <p className="text-sm font-medium">Project #{item.projectId}</p>
                              <p className="text-xs text-muted-foreground">Status: pending</p>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 px-2"
                                  disabled={isProcessing}
                                  onClick={() => handleAcceptInvitation(item)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  disabled={isProcessing}
                                  onClick={() => handleDeclineInvitation(item)}
                                >
                                  Decline
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-md hover:bg-accent px-3 py-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {user.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-sm font-medium">{user.username}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/settings">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Link to="/login">
                  <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                    Sign In
                  </button>
                </Link>
              )}
            </header>

            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>

        <AdminFooter />
      </div>
    </SidebarProvider>
  )
}

function AdminFooter() {
  const { state } = useSidebar()
  const desktopOffsetClass =
    state === 'expanded'
      ? 'md:pl-[var(--sidebar-width)]'
      : 'md:pl-0'

  return (
    <footer
      className={`border-t bg-background transition-[padding-left] duration-200 ease-linear ${desktopOffsetClass}`}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Kest Platform. Built with Vite + React + Go.
          </p>
          <div className="flex gap-4">
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
              Documentation
            </Link>
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
              GitHub
            </Link>
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
