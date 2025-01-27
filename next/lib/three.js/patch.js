import * as THREE from 'three';

const Vector3 = THREE.Vector3;
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _intersectPointOnRay = new THREE.Vector3();
const _intersectPointOnSegment = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _ray = new THREE.Ray();
const _inverseMatrix = new THREE.Matrix4();
const _sphere$1 = new THREE.Sphere();
const _ray$1 = new THREE.Ray();
const _inverseMatrix$1 = new THREE.Matrix4();
const _position$2 = new THREE.Vector3();

// For indexed geometries, we want intersection.index to reference an item in the index array,
// not the position array.
function checkIntersection( object, raycaster, ray, thresholdSq, a, b ) {

	const positionAttribute = object.geometry.attributes.position;

	_vStart.fromBufferAttribute( positionAttribute, a );
	_vEnd.fromBufferAttribute( positionAttribute, b );

	const distSq = ray.distanceSqToSegment( _vStart, _vEnd, _intersectPointOnRay, _intersectPointOnSegment );

	if ( distSq > thresholdSq ) return;

	_intersectPointOnRay.applyMatrix4( object.matrixWorld ); // Move back to world space for distance calculation

	const distance = raycaster.ray.origin.distanceTo( _intersectPointOnRay );

	if ( distance < raycaster.near || distance > raycaster.far ) return;

	return {

		distance: distance,
		// What do we want? intersection point on the ray or on the segment??
		// point: raycaster.ray.at( distance ),
		point: _intersectPointOnSegment.clone().applyMatrix4( object.matrixWorld ),
		index: a,
		face: null,
		faceIndex: null,
		barycoord: null,
		object: object

	};

}

THREE.Line.prototype.raycast = function raycast( raycaster, intersects ) {

    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Line.threshold;
    const drawRange = geometry.drawRange;

    // Checking boundingSphere distance to ray

    if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();

    _sphere$1.copy( geometry.boundingSphere );
    _sphere$1.applyMatrix4( matrixWorld );
    _sphere$1.radius += threshold;

    if ( raycaster.ray.intersectsSphere( _sphere$1 ) === false ) return;

    //

    _inverseMatrix$1.copy( matrixWorld ).invert();
    _ray$1.copy( raycaster.ray ).applyMatrix4( _inverseMatrix$1 );

    const localThreshold = threshold / ( ( this.scale.x + this.scale.y + this.scale.z ) / 3 );
    const localThresholdSq = localThreshold * localThreshold;

    const step = this.isLineSegments ? 2 : 1;

    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position;

    if ( index !== null ) {

      const start = Math.max( 0, drawRange.start );
      const end = Math.min( index.count, ( drawRange.start + drawRange.count ) );

      for ( let i = start, l = end - 1; i < l; i += step ) {

        const a = index.getX( i );
        const b = index.getX( i + 1 );

        const intersect = checkIntersection( this, raycaster, _ray$1, localThresholdSq, a, b );

        if ( intersect ) {
          intersect.index = i / step;
          intersects.push( intersect );

        }

      }

      if ( this.isLineLoop ) {

        const a = index.getX( end - 1 );
        const b = index.getX( start );

        const intersect = checkIntersection( this, raycaster, _ray$1, localThresholdSq, a, b );

        if ( intersect ) {
          intersect.index = ( end - 1 ) / step;
          intersects.push( intersect );

        }

      }

    } else {

      const start = Math.max( 0, drawRange.start );
      const end = Math.min( positionAttribute.count, ( drawRange.start + drawRange.count ) );

      for ( let i = start, l = end - 1; i < l; i += step ) {

        const intersect = checkIntersection( this, raycaster, _ray$1, localThresholdSq, i, i + 1 );

        if ( intersect ) {

          intersects.push( intersect );

        }

      }

      if ( this.isLineLoop ) {

        const intersect = checkIntersection( this, raycaster, _ray$1, localThresholdSq, end - 1, start );

        if ( intersect ) {

          intersects.push( intersect );

        }

      }

    }

  }



// For intersections with Points, we want the intersection to be the point itself, not the point on
// the ray. This is consistent with other intersections.

function testPoint( point, index, localThresholdSq, matrixWorld, raycaster, intersects, object ) {

  const rayPointDistanceSq = _ray.distanceSqToPoint( point );

  if ( rayPointDistanceSq < localThresholdSq ) {

    const intersectPoint = new Vector3();

    _ray.closestPointToPoint( point, intersectPoint );
    intersectPoint.applyMatrix4( matrixWorld );

    const distance = raycaster.ray.origin.distanceTo( intersectPoint );

    if ( distance < raycaster.near || distance > raycaster.far ) return;

    intersects.push( {

      distance: distance,
      distanceToRay: Math.sqrt( rayPointDistanceSq ),
      point: point.clone(),
      index: index,
      face: null,
      faceIndex: null,
      barycoord: null,
      object: object

    } );

  }

}


THREE.Points.prototype.raycast = function raycast( raycaster, intersects ) {

    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Points.threshold;
    const drawRange = geometry.drawRange;

    // Checking boundingSphere distance to ray

    if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();

    _sphere.copy( geometry.boundingSphere );
    _sphere.applyMatrix4( matrixWorld );
    _sphere.radius += threshold;

    if ( raycaster.ray.intersectsSphere( _sphere ) === false ) return;

    //

    _inverseMatrix.copy( matrixWorld ).invert();
    _ray.copy( raycaster.ray ).applyMatrix4( _inverseMatrix );

    const localThreshold = threshold / ( ( this.scale.x + this.scale.y + this.scale.z ) / 3 );
    const localThresholdSq = localThreshold * localThreshold;

    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position;

    if ( index !== null ) {

      const start = Math.max( 0, drawRange.start );
      const end = Math.min( index.count, ( drawRange.start + drawRange.count ) );

      for ( let i = start, il = end; i < il; i ++ ) {

        const a = index.getX( i );

        _position$2.fromBufferAttribute( positionAttribute, a );

        testPoint( _position$2, a, localThresholdSq, matrixWorld, raycaster, intersects, this );

      }

    } else {

      const start = Math.max( 0, drawRange.start );
      const end = Math.min( positionAttribute.count, ( drawRange.start + drawRange.count ) );

      for ( let i = start, l = end; i < l; i ++ ) {

        _position$2.fromBufferAttribute( positionAttribute, i );

        testPoint( _position$2, i, localThresholdSq, matrixWorld, raycaster, intersects, this );

      }

    }

  }
