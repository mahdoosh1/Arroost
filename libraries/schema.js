export const Schema = class {
	constructor({ check, make, diagnose } = {}) {
		this.check = check
		this.make = make
		this.diagnose = diagnose || ((value) => value)
	}

	validate(value) {
		if (!this.check(value)) {
			throw new Error(`Invalid value ^`)
		}
	}

	and(other) {
		return new Schema({
			check: (value) => this.check(value) && other.check(value),
			make: other.make || this.make,
			diagnose: (value) => {
				if (!this.check(value)) {
					return this.diagnose(value)
				}
				return other.diagnose(value)
			},
		})
	}

	or(other) {
		return new Schema({
			check: (value) => this.check(value) || other.check(value),
			make: this.make,
			diagnose: (value) => {
				if (!this.check(value)) {
					return this.diagnose(value)
				}
				return other.diagnose(value)
			},
		})
	}

	not() {
		return new Schema({
			check: (value) => !this.check(value),
		})
	}

	withMake(make) {
		return new Schema({
			check: this.check,
			make,
			diagnose: this.diagnose,
		})
	}

	withCheck(check) {
		return new Schema({
			check,
			make: this.make,
			diagnose: this.diagnose,
		})
	}

	andCheck(check) {
		return new Schema({
			check: (value) => this.check(value) && check(value),
			make: this.make,
			diagnose: this.diagnose,
		})
	}

	withDefault(defaultValue) {
		return new Schema({
			check: this.check,
			make: () => defaultValue,
			diagnose: this.diagnose,
		})
	}

	withDiagnose(diagnose) {
		return new Schema({
			check: this.check,
			make: this.make,
			diagnose,
		})
	}

	nullable() {
		return Schema.Null.or(this)
	}

	static reference(key) {
		return new Schema({
			check: (value) => this[key].check(value),
			make: () => this[key].make(),
			diagnose: (value) => this[key].diagnose(value),
		})
	}
}

Schema.Number = new Schema({
	check: (value) => typeof value === "number",
	make: () => 0,
})

Schema.String = new Schema({
	check: (value) => typeof value === "string",
	make: () => "",
})

Schema.Boolean = new Schema({
	check: (value) => typeof value === "boolean",
	make: () => false,
})

Schema.Array = new Schema({
	check: (value) => Array.isArray(value),
	make: () => [],
})

Schema.Tuple = (schemas) => {
	const check = (value) => {
		if (value.length !== schemas.length) {
			return false
		}
		for (const i in schemas) {
			if (!schemas[i].check(value[i])) {
				return false
			}
		}
		return true
	}

	const make = () => {
		return schemas.map((schema) => schema.make())
	}

	return Schema.Array.andCheck(check).withMake(make)
}

Schema.Object = new Schema({
	check: (value) => typeof value === "object" && !Schema.Array.check(value),
	make: () => ({}),
})

Schema.Function = new Schema({
	check: (value) => typeof value === "function",
	make: () => () => {},
})

Schema.Any = new Schema({
	check: () => true,
	make: () => undefined,
})

Schema.PartialStruct = (struct) => {
	const check = (value) => {
		for (const key in struct) {
			if (!struct[key].check(value[key])) {
				return false
			}
		}
		return true
	}

	const make = () => {
		const object = {}
		for (const key in struct) {
			object[key] = struct[key].make()
		}
		return object
	}

	const diagnose = (value) => {
		for (const key in struct) {
			if (!struct[key].check(value[key])) {
				return [key, struct[key]?.diagnose?.(value[key])]
			}
		}
	}

	const schema = Schema.Object.andCheck(check).withMake(make).withDiagnose(diagnose)
	schema.struct = struct
	schema.extend = (other) => {
		const struct = { ...schema.struct, ...other }
		return Schema.PartialStruct(struct)
	}
	return schema
}

Schema.Struct = (struct) => {
	const partial = Schema.PartialStruct(struct)
	const check = (value) => {
		for (const key in value) {
			if (!struct[key]) {
				return false
			}
		}
		return true
	}
	const schema = partial.andCheck(check)
	schema.struct = struct
	schema.extend = (other) => {
		const struct = { ...schema.struct, ...other }
		return Schema.Struct(struct)
	}
	return schema
}

Schema.ArrayOf = (schema) => {
	const check = (value) => {
		for (const item of value) {
			if (!schema.check(item)) {
				return false
			}
		}
		return true
	}
	return Schema.Array.andCheck(check)
}

Schema.Enum = (values) => {
	const set = new Set(values)
	const check = (value) => {
		return set.has(value)
	}

	const [head] = values
	const make = () => {
		return head
	}

	const schema = new Schema({ check, make })
	schema.values = values
	return schema
}

Schema.Finite = Schema.Number.withCheck((value) => Number.isFinite(value))
Schema.Integer = Schema.Number.withCheck((value) => Number.isInteger(value))
Schema.SafeInteger = Schema.Number.withCheck((value) => Number.isSafeInteger(value))

Schema.Negative = Schema.Number.andCheck((value) => value <= 0)
Schema.Positive = Schema.Number.andCheck((value) => value >= 0)
Schema.PositiveInteger = Schema.Integer.and(Schema.Positive)
Schema.SafePositiveInteger = Schema.SafeInteger.and(Schema.Positive)

Schema.Vector2D = Schema.Tuple([Schema.Finite, Schema.Finite])
Schema.Vector3D = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])

Schema.Truthy = new Schema({
	check: (value) => !!value,
	make: () => true,
})

Schema.Falsy = new Schema({
	check: (value) => !value,
	make: () => false,
})

Schema.Value = (schema) => {
	return new Schema({
		check: (value) => value === schema,
		make: () => schema,
	})
}

Schema.True = Schema.Value(true)
Schema.False = Schema.Value(false)

Schema.Undefined = Schema.Value(undefined)
Schema.Null = Schema.Value(null)

Schema.ObjectWith = ({ keysOf = Schema.Any, valuesOf = Schema.Any } = {}) => {
	const stringKeysOf = Schema.Stringified(keysOf)
	const check = (value) => {
		for (const key in value) {
			if (!stringKeysOf.check(key) || !valuesOf.check(value[key])) {
				return false
			}
		}
		return true
	}
	const diagnose = (value) => {
		for (const key in value) {
			if (!stringKeysOf.check(key)) {
				return stringKeysOf.diagnose(key)
			}
			if (!valuesOf.check(value[key])) {
				return [key, valuesOf.diagnose(value[key])]
			}
		}
	}

	return Schema.Object.andCheck(check).withDiagnose(diagnose)
}

Schema.Stringified = (schema) => {
	const check = (value) => {
		try {
			return schema.check(JSON.parse(value))
		} catch (error) {
			return false
		}
	}

	const make = () => {
		return JSON.stringify(schema.make())
	}

	return new Schema({ check, make })
}