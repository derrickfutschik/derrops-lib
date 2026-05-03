import 'reflect-metadata'

export const ALLOW_LEADING_TRAILING_SPACE_KEY = 'validation:allowLeadingTrailingSpace'

export function AllowLeadingTrailingSpace(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(ALLOW_LEADING_TRAILING_SPACE_KEY, true, target, propertyKey)
  }
}
