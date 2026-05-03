"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchIcon, InfoIcon, MailIcon } from "lucide-react"

const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const
const sizes = ["xs", "sm", "default", "lg", "xl", "2xl"] as const

export function ButtonShowcase() {
  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Buttons & Actions</h2>
        <Badge variant="outline">Matrix View</Badge>
      </div>

      <div className="overflow-x-auto border rounded-xl bg-card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-4 text-sm font-medium text-text-muted">Size / Variant</th>
              {variants.map((v) => (
                <th key={v} className="p-4 text-sm font-medium capitalize">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                <td className="p-4 text-sm font-mono text-text-muted capitalize">{s}</td>
                {variants.map((v) => (
                  <td key={`${s}-${v}`} className="p-4">
                    <Button variant={v} size={s}>Button</Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">Integrated Icon Prop</h3>
          <div className="flex flex-wrap gap-4 items-center p-6 border rounded-xl bg-card">
            <Button icon={<SearchIcon className="size-4" />}>Search Left</Button>
            <Button icon={<SearchIcon className="size-4" />} iconPosition="right">Search Right</Button>
            <Button variant="outline" icon={<InfoIcon className="size-4" />} size="sm">Small with Icon</Button>
            <Button variant="secondary" icon={<InfoIcon className="size-5" />} size="xl">Large with Icon</Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">Loading States (Smart Transition)</h3>
          <div className="flex flex-wrap gap-4 items-center p-6 border rounded-xl bg-card">
            <Button size="sm" loading>Loading Text</Button>
            <Button size="sm" icon={<MailIcon className="size-4" />} loading>With Icon</Button>
            <Button size="sm" icon={<SearchIcon className="size-4" />} iconPosition="right" loading>Right Icon</Button>
            <Button variant="outline" isIcon loading>
              <SearchIcon className="size-4" />
            </Button>
            <Button variant="ghost" isIcon icon={<InfoIcon className="size-4" />} loading />
          </div>
        </div>
      </div>
    </section>
  )
}
