import React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '../../../../components/ui/input'
import { Button } from '../../../../components/ui/button'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string) => void
  placeholder?: string
  isLoading?: boolean
  disabled?: boolean
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Search for videos...",
  isLoading = false,
  disabled = false
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
    }
  }

  const handleClear = () => {
    onChange('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3 z-10">
          <Search 
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : 'text-muted-foreground'}`} 
          />
        </div>
        
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="pl-10 pr-20 h-10"
          autoComplete="off"
        />
        
        <div className="absolute right-1 flex items-center gap-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled || isLoading}
              className="h-8 w-8 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            type="submit"
            size="sm"
            disabled={disabled || isLoading || !value.trim()}
            className="h-8 px-3"
          >
            Search
          </Button>
        </div>
      </div>
    </form>
  )
}

export default SearchInput 