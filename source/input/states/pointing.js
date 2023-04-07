import { State } from "../../../libraries/habitat-import.js"
import { shared } from "../../main.js"
import { setCursor } from "../cursor.js"
import { Dragging } from "./dragging.js"
import { Idle } from "./idle.js"

export const Pointing = new State({
	input: undefined,

	enter() {
		const { input } = shared.hover
		this.input = input
		input.pointed = true
		setCursor("pointer")
	},

	pointerup(event) {
		const { input } = this
		input.fire("onRelease", event)
		input.pointed = false
		return Idle
	},

	pointermove(event) {
		const { input } = this
		input.fire("onGrab", event)
		return Dragging
	},
})
