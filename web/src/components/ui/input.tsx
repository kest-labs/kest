/**
 * @component Input
 * @category UI
 * @status Stable
 * @description A standard input field with support for icons, error states, and specialized types like search, password, and color.
 * @usage Use in forms for text, email, password, or search inputs. Automatically handles date and color types with custom pickers.
 * @example
 * <Input placeholder="Username" leftIcon={<User />} errorText="Username is required" />
 * <PasswordInput placeholder="Password" />
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { SearchIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { DatePicker } from "./date-picker"

import { cn } from "@/utils"

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-11 w-full min-w-0 rounded-md border px-4 py-3 text-base shadow-none transition-colors file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-sm input-depth outline-hidden focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand",
  {
    variants: {
      variant: {
        outline: "border-border-strong bg-bg-canvas hover:border-border-strong",
        filled: "border-border-main bg-bg-surface hover:border-border-strong focus-visible:bg-bg-canvas",
      },
      error: {
        true: "border-destructive bg-error-subtle focus-visible:border-destructive text-destructive placeholder:text-destructive/60",
      }
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

interface InputProps extends React.ComponentProps<"input">, VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  error?: boolean
  errorText?: React.ReactNode
  root?: boolean
}

const padDateInputNumber = (value: number) => String(value).padStart(2, "0")

const formatDateInputValue = (date: Date, type: React.HTMLInputTypeAttribute | undefined) => {
  const baseValue = [
    date.getFullYear(),
    padDateInputNumber(date.getMonth() + 1),
    padDateInputNumber(date.getDate()),
  ].join("-")

  if (type !== "datetime-local") {
    return baseValue
  }

  return `${baseValue}T${padDateInputNumber(date.getHours())}:${padDateInputNumber(date.getMinutes())}:${padDateInputNumber(date.getSeconds())}`
}

const createDateInputChangeEvent = (
  value: string,
  name?: string,
  id?: string
): React.ChangeEvent<HTMLInputElement> =>
  ({
    target: { value, name, id },
    currentTarget: { value, name, id },
  }) as unknown as React.ChangeEvent<HTMLInputElement>

function Input({
  className,
  variant,
  type,
  leftIcon,
  rightIcon,
  error,
  errorText,
  root,
  ...props
}: InputProps) {
  if (type === "date" || type === "datetime-local") {
    const dateValue =
      props.value instanceof Date || typeof props.value === "string" ? props.value : undefined

    return (
      <DatePicker 
        showTime={type === "datetime-local"} 
        error={error || !!errorText}
        errorText={typeof errorText === 'string' ? errorText : undefined}
        placeholder={props.placeholder}
        className={className}
        value={dateValue}
        onChange={(date) => {
          props.onChange?.(
            createDateInputChangeEvent(
              formatDateInputValue(date, type),
              props.name,
              props.id
            )
          )
        }}
      />
    )
  }

  if (type === "color") {
    return (
      <ColorPicker 
        error={error}
        errorText={errorText}
        className={className}
        {...props}
      />
    )
  }

  const isError = error || !!errorText

  const inputNode = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputVariants({ variant, error: isError, className }),
        leftIcon && "pl-10",
        rightIcon && "pr-10"
      )}
      {...props}
    />
  )

  const withIcons = (leftIcon || rightIcon) ? (
    <div className="relative flex w-full items-center">
      {leftIcon && (
        <div className="absolute left-3 flex items-center justify-center text-muted-foreground pointer-events-none">
          {leftIcon}
        </div>
      )}
      {inputNode}
      {rightIcon && (
        <div className="absolute right-3 flex items-center justify-center text-muted-foreground">
          {rightIcon}
        </div>
      )}
    </div>
  ) : inputNode

  if (root || errorText) {
    return (
      <div className="flex flex-col gap-0.5 w-full">
        {withIcons}
        {errorText && (
          <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
            {errorText}
          </p>
        )}
      </div>
    )
  }

  return withIcons
}

function SearchInput({ className, ...props }: InputProps) {
  return (
    <Input
      type="search"
      leftIcon={<SearchIcon className="size-4" />}
      className={cn("h-10 rounded-md border-border-main bg-bg-surface text-sm text-text-muted", className)}
      {...props}
    />
  )
}

function PasswordInput({ className, ...props }: InputProps) {
  const [show, setShow] = React.useState(false)

  return (
    <Input
      type={show ? "text" : "password"}
      rightIcon={
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="hover:text-foreground cursor-pointer transition-colors outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-full pointer-events-auto"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      }
      className={className}
      {...props}
    />
  )
}

function ColorPicker({ className, value, onChange, disabled, error, errorText, ...props }: InputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [internalValue, setInternalValue] = React.useState(typeof value === 'string' ? value : "#000000")
  
  const color = typeof value === 'string' ? value : internalValue

  const handleTrigger = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const isError = error || !!errorText

  return (
    <div className="flex flex-col gap-1 w-full">
      <div 
        onClick={handleTrigger}
          className={cn(
          "flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border border-border-strong bg-background px-4 py-2 shadow-none transition-colors hover:border-border-strong input-depth focus-within:border-brand focus-within:ring-1 focus-within:ring-brand",
          disabled && "opacity-50 cursor-not-allowed",
          isError && "border-destructive focus-within:border-destructive",
          className
        )}
      >
        <div 
          className="size-5 rounded-full border border-border-strong/20 shadow-none shrink-0" 
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-sm font-medium uppercase tracking-[0.03125rem] text-foreground/80 first-letter:uppercase">
          {color}
        </span>
        <input 
          ref={inputRef}
          type="color" 
          className="sr-only"
          value={color}
          disabled={disabled}
          onChange={(e) => {
            const newVal = e.target.value
            setInternalValue(newVal)
            onChange?.(e)
          }}
          {...props}
        />
      </div>
      {errorText && (
        <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
          {errorText}
        </p>
      )}
    </div>
  )
}

export { Input, SearchInput, PasswordInput, ColorPicker }
