/**
 * Geometry utilities for handling points, rectangles and transformations
 */

// Point class for 2D coordinates
export class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // Create a Point from an object with x,y properties
    static create(pointLike) {
        if (pointLike instanceof Point) {
            return pointLike;
        }
        return new Point(pointLike.x, pointLike.y);
    }

    // Calculate distance between two points
    distance(point) {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate angle between this point and another point
    angle(point) {
        return Math.atan2(point.y - this.y, point.x - this.x);
    }

    // Calculate angle between this point and another point in degrees
    angleDeg(point) {
        return this.angle(point) * 180 / Math.PI;
    }

    // Add another point to this one
    add(point) {
        return new Point(this.x + point.x, this.y + point.y);
    }

    // Subtract another point from this one
    subtract(point) {
        return new Point(this.x - point.x, this.y - point.y);
    }

    // Scale this point
    scale(sx, sy = sx) {
        return new Point(this.x * sx, this.y * sy);
    }

    // Rotate this point around an origin
    rotate(angle, origin = new Point(0, 0)) {
        const radians = angle * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const dx = this.x - origin.x;
        const dy = this.y - origin.y;

        const x = dx * cos - dy * sin + origin.x;
        const y = dx * sin + dy * cos + origin.y;

        return new Point(x, y);
    }

    // Clone this point
    clone() {
        return new Point(this.x, this.y);
    }

    // Normalize angle in degrees (0-360)
    static normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360;
    }
}

// Rectangle class for bounds and intersections
export class Rectangle {
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Create a Rectangle from an object with x,y,width,height properties
    static create(rectLike) {
        if (rectLike instanceof Rectangle) {
            return rectLike;
        }
        return new Rectangle(
            rectLike.x,
            rectLike.y,
            rectLike.width,
            rectLike.height
        );
    }

    // Create a Rectangle from its size
    static fromSize(size) {
        return new Rectangle(0, 0, size.width, size.height);
    }

    // Get center point of rectangle
    getCenter() {
        return new Point(
            this.x + this.width / 2,
            this.y + this.height / 2
        );
    }

    // Get top-left point
    getTopLeft() {
        return new Point(this.x, this.y);
    }

    // Get top-right point
    getTopRight() {
        return new Point(this.x + this.width, this.y);
    }

    // Get bottom-left point
    getBottomLeft() {
        return new Point(this.x, this.y + this.height);
    }

    // Get bottom-right point
    getBottomRight() {
        return new Point(this.x + this.width, this.y + this.height);
    }

    // Get top-center point
    getTopCenter() {
        return new Point(this.x + this.width / 2, this.y);
    }

    // Get bottom-center point
    getBottomCenter() {
        return new Point(this.x + this.width / 2, this.y + this.height);
    }

    // Get left-center point
    getLeftCenter() {
        return new Point(this.x, this.y + this.height / 2);
    }

    // Get right-center point
    getRightCenter() {
        return new Point(this.x + this.width, this.y + this.height / 2);
    }

    // Check if this rectangle contains a point
    containsPoint(point) {
        return (
            point.x >= this.x &&
            point.x <= this.x + this.width &&
            point.y >= this.y &&
            point.y <= this.y + this.height
        );
    }

    // Check if this rectangle contains another rectangle
    containsRect(rect) {
        return (
            rect.x >= this.x &&
            rect.x + rect.width <= this.x + this.width &&
            rect.y >= this.y &&
            rect.y + rect.height <= this.y + this.height
        );
    }

    // Check if this rectangle intersects with another
    isIntersectWithRect(rect) {
        return !(
            rect.x > this.x + this.width ||
            rect.x + rect.width < this.x ||
            rect.y > this.y + this.height ||
            rect.y + rect.height < this.y
        );
    }

    // Expand rectangle in all directions
    inflate(dx, dy = dx) {
        return new Rectangle(
            this.x - dx,
            this.y - dy,
            this.width + 2 * dx,
            this.height + 2 * dy
        );
    }

    // Move and expand rectangle
    moveAndExpand(options) {
        return new Rectangle(
            this.x + (options.x || 0),
            this.y + (options.y || 0),
            this.width + (options.width || 0),
            this.height + (options.height || 0)
        );
    }

    // Union with another rectangle
    union(rect) {
        const x = Math.min(this.x, rect.x);
        const y = Math.min(this.y, rect.y);
        const width = Math.max(this.x + this.width, rect.x + rect.width) - x;
        const height = Math.max(this.y + this.height, rect.y + rect.height) - y;

        return new Rectangle(x, y, width, height);
    }

    // Clone this rectangle
    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }
}