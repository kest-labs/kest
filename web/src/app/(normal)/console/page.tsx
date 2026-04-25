"use client"

import * as React from "react"
import { 
  Zap, 
  Activity, 
  CheckCircle, 
  Clock,
  Plus,
  Users,
  Settings,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { StatCard } from "@/components/features/console/dashboard-stats"
import { DashboardChart } from "@/components/features/console/dashboard-chart"
import { ActivityTimeline, type ActivityItem } from "@/components/features/console/activity-timeline"
import { useT } from "@/i18n/client"

/**
 * Premium Console Dashboard Page
 * Demonstrates exemplary patterns for building console pages with i18n support.
 */
export default function ConsolePage() {
  const t = useT()

  // Data generated inside component to support translations
  const statsData = [
    {
      title: t('dashboard.stats.activeWorkflows'),
      value: "12",
      description: t('dashboard.stats.pendingApproval', { count: 3 }),
      trend: { value: "+2", isPositive: true },
      icon: Zap,
      variant: "primary" as const,
    },
    {
      title: t('dashboard.stats.apiCalls'),
      value: "2,350",
      description: t('dashboard.stats.avgPerHour', { count: 98 }),
      trend: { value: "+180", isPositive: true },
      icon: Activity,
      variant: "default" as const,
    },
    {
      title: t('dashboard.stats.successRate'),
      value: "99.2%",
      description: t('dashboard.stats.last24Hours'),
      trend: { value: "+0.1%", isPositive: true },
      icon: CheckCircle,
      variant: "success" as const,
    },
    {
      title: t('dashboard.stats.responseTime'),
      value: "142ms",
      description: t('dashboard.stats.withinSla'),
      trend: { value: "-12ms", isPositive: true },
      icon: Clock,
      variant: "default" as const,
    },
  ]

  const chartData = [
    { name: "Mon", value: 120 },
    { name: "Tue", value: 180 },
    { name: "Wed", value: 150 },
    { name: "Thu", value: 220 },
    { name: "Fri", value: 280 },
    { name: "Sat", value: 190 },
    { name: "Sun", value: 140 },
  ]

  const responseTimeData = [
    { name: "Mon", value: 168 },
    { name: "Tue", value: 142 },
    { name: "Wed", value: 149 },
    { name: "Thu", value: 131 },
    { name: "Fri", value: 154 },
    { name: "Sat", value: 146 },
    { name: "Sun", value: 138 },
  ]

  const activityItems: ActivityItem[] = [
    {
      id: "1",
      type: "success",
      title: "Workflow deployed successfully",
      description: "GPT-4 Translation Pipeline is now live",
      timestamp: "2 minutes ago",
      user: { name: "Admin", initials: "AD" },
    },
    {
      id: "2",
      type: "action",
      title: "New API key generated",
      description: "Production environment key",
      timestamp: "15 minutes ago",
      user: { name: "John Doe", initials: "JD" },
    },
    {
      id: "3",
      type: "warning",
      title: "Rate limit threshold reached",
      description: "85% of daily quota consumed",
      timestamp: "1 hour ago",
    },
    {
      id: "4",
      type: "config",
      title: "Settings updated",
      description: "Email notifications enabled",
      timestamp: "3 hours ago",
      user: { name: "Jane Smith", initials: "JS" },
    },
    {
      id: "5",
      type: "info",
      title: "System maintenance scheduled",
      description: "Planned for Sunday 2:00 AM UTC",
      timestamp: "Yesterday",
    },
  ]

  const tableData = [
    { id: "WF-001", name: "Translation Pipeline", status: "Active", calls: "1,234", success: "99.8%" },
    { id: "WF-002", name: "Content Moderation", status: "Active", calls: "856", success: "98.5%" },
    { id: "WF-003", name: "Data Extraction", status: "Paused", calls: "432", success: "97.2%" },
    { id: "WF-004", name: "Sentiment Analysis", status: "Active", calls: "2,108", success: "99.1%" },
  ]

  return (
    <div className="flex-1 space-y-8 p-6 pt-6">
      {/* Page Header with gradient accent */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-primary/10 via-purple-500/5 to-transparent p-6 border border-primary/10 transition-colors duration-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS1vcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {t('dashboard.welcome')}
              </h1>
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <p className="text-text-muted transition-colors duration-500">
              {t('dashboard.welcomeDescription')}
            </p>
          </div>
          <Button className="gap-2 rounded-xl shadow-button-primary">
            <Plus className="h-4 w-4" />
            {t('dashboard.newWorkflow')}
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            trend={stat.trend}
            icon={stat.icon}
            variant={stat.variant}
          />
        ))}
      </div>

      {/* Charts and Activity Section */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {/* API Usage Chart */}
          <DashboardChart 
            title={t('dashboard.charts.apiCallsTitle')} 
            data={chartData} 
            type="bar"
            height={180}
          />
          
          {/* Line Chart */}
          <DashboardChart 
            title={t('dashboard.charts.responseTimeTitle')} 
            data={responseTimeData} 
            type="line"
            height={160}
          />
        </div>
        
        <div className="lg:col-span-2 h-full">
          <ActivityTimeline 
            items={activityItems} 
            title={t('dashboard.activity.title')}
            viewAllLabel={t('dashboard.activity.viewAll')}
          />
        </div>
      </div>

      {/* Workflows Table */}
      <Card className="shadow-premium overflow-hidden border-border/50">
        <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-4 px-6">
          <CardTitle className="text-lg font-semibold">{t('dashboard.workflows.title')}</CardTitle>
          <Button variant="ghost" size="sm" className="gap-2 text-primary hover:bg-primary/10">
            {t('dashboard.activity.viewAll')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent border-b-border/50">
                <TableHead className="w-24 pl-6">{t('dashboard.workflows.id')}</TableHead>
                <TableHead>{t('dashboard.workflows.name')}</TableHead>
                <TableHead>{t('dashboard.workflows.status')}</TableHead>
                <TableHead className="text-right">{t('dashboard.workflows.calls')}</TableHead>
                <TableHead className="text-right pr-6">{t('dashboard.workflows.success')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.id} className="interactive-bg transition-colors cursor-pointer border-b-border/30">
                  <TableCell className="font-mono text-xs text-text-muted pl-6">{row.id}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "Active" ? "default" : "secondary"} className="rounded-md">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-success pr-6">{row.success}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="group cursor-pointer transition-all duration-300 hover:shadow-premium hover:-translate-y-1 hover:border-primary/40 border-border/50 bg-bg-surface overflow-hidden">
          <CardContent className="flex items-center gap-4 p-6 relative">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-10 transition-opacity">
              <Plus className="h-12 w-12 text-primary" />
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground transform group-hover:scale-110 shadow-sm">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{t('dashboard.actions.createWorkflow')}</h3>
              <p className="text-sm text-text-subtle">{t('dashboard.actions.createWorkflowDesc')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer transition-all duration-300 hover:shadow-premium hover:-translate-y-1 hover:border-primary/40 border-border/50 bg-bg-surface overflow-hidden">
          <CardContent className="flex items-center gap-4 p-6 relative">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-10 transition-opacity">
              <Users className="h-12 w-12 text-primary" />
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-text-muted transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground transform group-hover:scale-110 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{t('dashboard.actions.manageUsers')}</h3>
              <p className="text-sm text-text-subtle">{t('dashboard.actions.manageUsersDesc')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer transition-all duration-300 hover:shadow-premium hover:-translate-y-1 hover:border-primary/40 border-border/50 bg-bg-surface overflow-hidden">
          <CardContent className="flex items-center gap-4 p-6 relative">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-10 transition-opacity">
              <Settings className="h-12 w-12 text-primary" />
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-text-muted transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground transform group-hover:scale-110 shadow-sm">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{t('dashboard.actions.settings')}</h3>
              <p className="text-sm text-text-subtle">{t('dashboard.actions.settingsDesc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
