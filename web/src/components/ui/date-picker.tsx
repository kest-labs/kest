/**
 * @component DatePicker
 * @category UI
 * @status Stable
 * @description A combined date and time picker component using a popover and calendar.
 * @usage Use for selecting specific points in time. Supports both date-only and date-time modes.
 * @example
 * <DatePicker date={date} setDate={setDate} showTime placeholder="Select meeting time" />
 */
"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Calendar } from "./calendar"
import { cn } from "@/utils"

import { useT } from "@/i18n/client"

interface DatePickerProps {
  date?: Date
  setDate?: (date: Date) => void
  value?: Date | string
  onChange?: (date: Date) => void
  placeholder?: string
  className?: string
  showTime?: boolean
  error?: boolean
  errorText?: string
}

const TimeColumn = ({ 
  max, 
  value, 
  onChange, 
  label 
}: { 
  max: number, 
  value: number, 
  onChange: (v: number) => void,
  label: string
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  
  React.useEffect(() => {
    if (scrollRef.current) {
      // index + 1 to skip the Spacer div
      const item = scrollRef.current.children[value + 1] as HTMLElement
      if (item) {
        // Center in new compact height: 260 / 2 - 32 / 2 = 114
        scrollRef.current.scrollTop = item.offsetTop - 114
      }
    }
  }, [value])

  return (
    <div className="flex flex-col items-center bg-bg-surface last:border-0 border-r border-border-main w-14 shrink-0 overflow-hidden">
      <div className="py-3 text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground/60">{label}</div>
      <div 
        ref={scrollRef}
        className="h-[260px] w-full overflow-y-auto no-scrollbar flex flex-col items-center relative overscroll-contain"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="h-[114px] shrink-0" /> {/* Top Spacer */}
        {Array.from({ length: max + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={cn(
              "size-8 shrink-0 flex items-center justify-center text-sm font-medium transition-colors duration-200 rounded-lg mb-2 last:mb-0 cursor-pointer",
              value === i 
                ? "bg-primary text-primary-foreground ring-2 ring-primary/12 z-10" 
                : "text-foreground/80 hover:bg-primary/10 hover:text-foreground"
            )}
          >
            {String(i).padStart(2, '0')}
          </button>
        ))}
        <div className="h-[114px] shrink-0" /> {/* Bottom Spacer */}
      </div>
    </div>
  )
}

export function DatePicker({ 
  date: propsDate, 
  setDate: propsSetDate, 
  value: propsValue,
  onChange: propsOnChange,
  placeholder, 
  className, 
  showTime = false,
  error,
  errorText
}: DatePickerProps) {
  const t = useT()
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(undefined)
  const [open, setOpen] = React.useState(false)

  // Standardize the source of truth for the date
  const date = propsDate || (propsValue instanceof Date ? propsValue : (typeof propsValue === 'string' ? new Date(propsValue) : internalDate))
  const setDate = (d: Date) => {
    propsSetDate?.(d)
    propsOnChange?.(d)
    setInternalDate(d)
  }

  const isError = error || !!errorText

  const formatDisplayDate = (d?: Date) => {
    if (!d) return ""
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!showTime) return dateStr
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    return `${dateStr} ${timeStr}`
  }

  const handleTimeChange = (type: 'h' | 'm' | 's', value: number) => {
    if (!date) return
    const newDate = new Date(date)
    if (type === 'h') newDate.setHours(value)
    if (type === 'm') newDate.setMinutes(value)
    if (type === 's') newDate.setSeconds(value)
    setDate?.(newDate)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-11 w-full cursor-pointer items-center justify-between rounded-md border border-border-strong bg-background px-4 py-2 text-left text-sm font-normal shadow-none transition-colors hover:border-border-strong focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand input-depth",
            !date && "text-muted-foreground",
            isError && "border-destructive focus:border-destructive text-destructive",
            className
          )}
        >
          <span className="truncate">{date && !isNaN(date.getTime()) ? formatDisplayDate(date) : (placeholder || t.common('datePlaceholder'))}</span>
          <CalendarIcon className={cn("size-4 opacity-50 shrink-0 ml-2", isError && "text-destructive opacity-100")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 overflow-hidden" align="start">
        <div className="flex bg-bg-canvas">
          <Calendar 
            selected={date} 
            showFooter={false}
            onSelect={(d) => {
              if (showTime && date) {
                const newDate = new Date(d)
                newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds())
                setDate?.(newDate)
              } else {
                setDate?.(d)
              }
              // Removed auto-close for consistency when footer is present
            }} 
          />
          {showTime && (
            <div className="flex border-l border-border-main animate-in slide-in-from-right-4">
              <TimeColumn label={t.common('hour').charAt(0)} max={23} value={date?.getHours() || 0} onChange={(v) => handleTimeChange('h', v)} />
              <TimeColumn label={t.common('minute').charAt(0)} max={59} value={date?.getMinutes() || 0} onChange={(v) => handleTimeChange('m', v)} />
              <TimeColumn label={t.common('second').charAt(0)} max={59} value={date?.getSeconds() || 0} onChange={(v) => handleTimeChange('s', v)} />
            </div>
          )}
        </div>
        <div className="p-2 border-t border-border-main flex items-center justify-between bg-bg-surface">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const now = new Date()
                setDate?.(now)
              }}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors duration-200 hover:bg-brand/8 hover:text-brand active:text-brand-strong"
            >
              {t.common('now')}
            </button>
          </div>
          <button 
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full bg-primary px-6 py-1.5 text-xs font-medium text-primary-foreground shadow-none transition-colors duration-200 hover:bg-primary active:bg-primary-strong"
          >
            {t.common('confirm')}
          </button>
        </div>
      </PopoverContent>
      {errorText && (
        <p className="text-xs font-medium text-destructive mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {errorText}
        </p>
      )}
    </Popover>
  )
}
