import { add, scale, subtract } from "../../libraries/habitat-import.js"
import { setCursor } from "../input/cursor.js"
import { Dragging } from "../input/states.js"
import { shared } from "../main.js"
import { Thing } from "./thing.js"

const PAN_FRICTION = 0.9
const ZOOM_FRICTION = 0.75

export const Camera = class extends Thing {
	zoomSpeed = this.use(0.0)

	tick() {
		const { pointer } = shared

		if (pointer.position.x === undefined || pointer.position.y === undefined) {
			return
		}

		pointer.tick()

		const { movement } = this
		const { velocity } = movement
		movement.update()
		movement.velocity = scale(velocity, PAN_FRICTION)

		this.zoom(this.zoomSpeed)
		this.zoomSpeed *= ZOOM_FRICTION
	}

	zoom(delta) {
		const { pointer } = shared
		const { transform } = this
		const oldZoom = transform.scale.x
		const newZoom = oldZoom * (1 - delta)
		transform.scale = [newZoom, newZoom]

		const pointerOffset = subtract(pointer.position, transform.position)
		const scaleRatio = newZoom / oldZoom
		const scaledPointerOffset = scale(pointerOffset, scaleRatio)
		transform.position = subtract(pointer.position, scaledPointerOffset)
	}

	onHoveringEnter() {
		setCursor("default")
	}

	onHoveringPointerDown() {
		return Dragging
	}

	onDraggingEnter(previous, state) {
		state.pointerStart = [...shared.pointer.position]
		state.cameraStart = [...this.transform.position]
		this.movement.velocity = [0, 0]
		setCursor("move")
	}

	onDraggingPointerUp() {
		this.movement.velocity = [...shared.pointer.velocity]
	}

	onDraggingPointerMove(event, state) {
		const { pointerStart, cameraStart } = state
		const pointerDisplacement = subtract(shared.pointer.position, pointerStart)
		this.transform.position = add(cameraStart, pointerDisplacement)
	}
}
