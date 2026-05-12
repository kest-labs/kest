/**
 * @component Calendar
 * @category UI
 * @status Stable
 * @description A date selection component with support for month/year navigation and today shortcut.
 * @usage Use for choosing specific dates in forms or filters. Internal logic uses native Date objects.
 * @example
 * <Calendar selected={date} onSelect={setDate} />
 */
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/utils"

import { useT } from "@/i18n/client"

// Simple date-fns like helpers using native Date
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  onToday?: () => void
  className?: string
  showFooter?: boolean
}

export function Calendar({ selected, onSelect, onToday, className, showFooter = true }: CalendarProps) {
  const t = useT()
  const [viewDate, setViewDate] = React.useState(selected || new Date())
  const [mode, setMode] = React.useState<"days" | "months" | "years">("days")
  const [yearInput, setYearInput] = React.useState(viewDate.getFullYear().toString())
  
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Sync view when selected date changes (e.g. "Now" clicked from outside)
  React.useEffect(() => {
    if (selected) {
      setViewDate(selected)
      setYearInput(selected.getFullYear().toString())
    }
  }, [selected])

  // Sync input when viewDate changes (e.g. from nav buttons)
  React.useEffect(() => {
    setYearInput(year.toString())
  }, [year])
  
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  
  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1))
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i)
  
  const isSelected = (day: number) => 
    selected?.getDate() === day && 
    selected?.getMonth() === month && 
    selected?.getFullYear() === year

  const isToday = (day: number) => {
    const today = new Date()
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
  }

  const weekDays = ["一", "二", "三", "四", "五", "六", "日"]
  const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(m => `${m}${t.common('month')}`)

  // Year Selection Logic
  const startYear = Math.floor(year / 12) * 12
  const years = Array.from({ length: 12 }, (_, i) => startYear + i)

  const handleYearSelect = (y: number) => {
    setViewDate(new Date(y, month, 1))
    setMode("days")
  }

  const handleMonthSelect = (m: number) => {
    setViewDate(new Date(year, m, 1))
    setMode("days")
  }

  const handleYearInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setYearInput(val)
    
    const num = parseInt(val)
    if (!isNaN(num) && num > 0 && num < 9999 && val.length === 4) {
      setViewDate(new Date(num, month, 1))
    }
  }

  return (
    <div className={cn("p-3 w-[260px]", className)}>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => {
            if (mode === "days") handlePrevMonth()
            else if (mode === "years") setViewDate(new Date(year - 12, month, 1))
            else setViewDate(new Date(year - 1, month, 1))
          }}
          className="size-8 flex items-center justify-center hover:bg-bg-subtle rounded-full transition-colors duration-200 text-muted-foreground hover:text-foreground active:bg-bg-surface cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div 
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium tracking-normal transition-colors duration-200"
        >
          {mode === "days" ? (
            <div className="flex items-center hover:bg-bg-subtle p-1 rounded-md transition-colors">
              <input
                type="text"
                value={yearInput}
                onChange={handleYearInput}
                onBlur={() => setYearInput(year.toString())}
                className="w-10 bg-transparent text-center focus:outline-hidden focus:bg-bg-canvas rounded px-0.5 border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span 
                className="cursor-pointer select-none px-1 rounded-sm hover:text-primary transition-colors duration-200 active:text-primary-strong"
                onClick={() => setMode("years")}
              >
                {t.common('year')}
              </span>
              <span 
                className="cursor-pointer select-none ml-1 px-1 rounded-sm hover:text-primary transition-colors duration-200 active:text-primary-strong"
                onClick={() => setMode("months")}
              >
                {month + 1}{t.common('month')}
              </span>
            </div>
          ) : mode === "years" ? (
            <span 
              className="cursor-pointer select-none px-3 py-1 rounded-md hover:bg-bg-subtle transition-colors duration-200 active:bg-bg-surface"
              onClick={() => setMode("days")}
            >
              {years[0]} - {years[years.length - 1]}
            </span>
          ) : (
            <span 
              className="cursor-pointer select-none px-3 py-1 rounded-md hover:bg-bg-subtle transition-colors duration-200 active:bg-bg-surface"
              onClick={() => setMode("days")}
            >
              {year}{t.common('year')}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (mode === "days") handleNextMonth()
            else if (mode === "years") setViewDate(new Date(year + 12, month, 1))
            else setViewDate(new Date(year + 1, month, 1))
          }}
          className="size-8 flex items-center justify-center hover:bg-bg-subtle rounded-full transition-colors duration-200 text-muted-foreground hover:text-foreground active:bg-bg-surface cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      
      {mode === "days" ? (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-[0.03125rem] text-muted-foreground/90">
            {weekDays.map(d => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          
          <div className="min-h-[212px]">
            <div className="grid grid-cols-7 gap-1">
              {emptyDays.map(i => <div key={`empty-${i}`} />)}
              {days.map(day => (
                <button
                  key={day}
                  onClick={() => onSelect?.(new Date(year, month, day))}
                  className={cn(
                    "size-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-200 relative cursor-pointer",
                    isSelected(day) 
                      ? "bg-primary text-primary-foreground z-10" 
                      : "hover:bg-bg-subtle active:bg-bg-surface",
                    isToday(day) && !isSelected(day) && "after:absolute after:bottom-1 after:size-1 after:bg-primary after:rounded-full after:animate-pulse",
                    !isSelected(day) && !isToday(day) && "text-foreground/90"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : mode === "years" ? (
        <div className="grid grid-cols-3 gap-2 min-h-[212px]">
          {years.map(y => (
            <button
              key={y}
              onClick={() => handleYearSelect(y)}
              className={cn(
                "h-12 flex items-center justify-center rounded-xl text-sm font-medium transition-colors cursor-pointer",
                y === year ? "bg-primary text-primary-foreground" : "hover:bg-bg-subtle text-foreground/80 active:bg-bg-surface"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 min-h-[212px]">
          {months.map((m, i) => (
            <button
              key={m}
              onClick={() => handleMonthSelect(i)}
              className={cn(
                "h-12 flex items-center justify-center rounded-xl text-sm font-medium transition-colors cursor-pointer",
                i === month ? "bg-primary text-primary-foreground" : "hover:bg-bg-subtle text-foreground/80 active:bg-bg-surface"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      
      {showFooter && (
        <div className="mt-4 pt-3 border-t border-border-main flex items-center justify-start text-xs text-muted-foreground/80">
          <button 
            onClick={() => {
              const now = new Date()
              onSelect?.(now)
              setViewDate(now)
              setMode("days")
              onToday?.()
            }}
            className="hover:text-primary transition-colors duration-200 font-medium px-2 py-1 rounded-md hover:bg-primary/5 cursor-pointer active:text-primary-strong"
          >
            {t.common('now')}
          </button>
        </div>
      )}
    </div>
  )
}
