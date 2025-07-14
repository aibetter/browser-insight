export const isNull = (value: unknown) => value === null

export const isUndefined = (value: unknown) => value === undefined

export const isNil = (value: unknown) => isNull(value) || isUndefined(value)
