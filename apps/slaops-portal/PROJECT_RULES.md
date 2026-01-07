# Project Rules

## Error Handling

### Try-Catch Blocks

**NEVER use `any` type in catch blocks.** Always use `unknown` and perform proper type checking.

#### ❌ Incorrect

```typescript
try {
  // some code
} catch (error: any) {
  console.error(error.message)
  toast({ description: error.message })
}
```

#### ✅ Correct

```typescript
try {
  // some code
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  console.error(message)
  toast({ description: message })
}
```

### Best Practices

1. **Always type catch parameters as `unknown`**: This enforces type safety and prevents accessing properties that may not exist.

2. **Use type guards**: Check if the error is an `Error` instance before accessing `.message` or other properties.

3. **Provide fallback messages**: When the error isn't an `Error` instance, provide a meaningful default message.

4. **Handle different error types**: Consider handling specific error types when appropriate:

   ```typescript
   try {
     // some code
   } catch (error: unknown) {
     if (error instanceof Error) {
       // Handle Error instance
       console.error(error.message)
     } else if (typeof error === 'string') {
       // Handle string errors
       console.error(error)
     } else {
       // Handle unknown error types
       console.error('An unexpected error occurred', error)
     }
   }
   ```

5. **For API errors**: When working with API clients, check for response errors:
   ```typescript
   try {
     await api.someMethod()
   } catch (error: unknown) {
     if (error instanceof Error && 'response' in error) {
       // Handle API error with response
       const apiError = error as { response?: { data?: { message?: string } } }
       const message = apiError.response?.data?.message || error.message
       toast({ description: message })
     } else {
       const message = error instanceof Error ? error.message : 'Failed to perform operation'
       toast({ description: message })
     }
   }
   ```

### Common Patterns

#### Toast Notifications

```typescript
try {
  await someAsyncOperation()
  toast({ title: 'Success', description: 'Operation completed' })
} catch (error: unknown) {
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Operation failed',
    variant: 'destructive',
  })
}
```

#### State Updates

```typescript
try {
  setLoading(true)
  const data = await fetchData()
  setData(data)
} catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Failed to load data')
} finally {
  setLoading(false)
}
```

#### Console Logging

```typescript
try {
  // some code
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('Error:', error.message, error.stack)
  } else {
    console.error('Unknown error:', error)
  }
}
```
