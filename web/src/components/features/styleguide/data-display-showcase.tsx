"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

const tableData = [
  { id: "1", name: "Premium Button", status: "Completed", date: "2024-01-14", value: "$420.00" },
  { id: "2", name: "Spring Motion", status: "In Progress", date: "2024-01-13", value: "$120.50" },
  { id: "3", name: "Glass Panel", status: "Review", date: "2024-01-12", value: "$95.00" },
]

export function DataDisplayShowcase() {
  return (
    <section className="space-y-8">
      <h2 className="text-2xl font-semibold">Data Display</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Optimized Table</h3>
        <div className="border rounded-xl bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow 
                  key={row.id} 
                  tabIndex={0}
                  className="interactive-bg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-inset"
                >
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "Completed" ? "default" : "secondary"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">{row.date}</TableCell>
                  <TableCell className="text-right font-medium">{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Badges</h3>
          <div className="flex flex-wrap gap-3 p-6 border rounded-xl bg-card items-center">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </div>

        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle>Premium Card</CardTitle>
            <CardDescription>Using the new --shadow-premium token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-subtle">
              Elevated shadows provide better visual hierarchy than standard borders alone.
            </p>
            <Separator />
            <div className="flex h-5 items-center space-x-4 text-sm font-medium">
              <div className="flex -space-x-2">
                <Avatar className="border-2 border-background size-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar className="border-2 border-background size-8">
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </div>
              <Separator orientation="vertical" />
              <div className="text-text-muted text-xs">Collaborators</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
