import { extend, useThree, useFrame, type ThreeElement } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { CADCameraControls } from './CADCameraControls'
import type { InputBindings, TouchBindings } from './types'

extend( { CADCameraControls } )

declare module '@react-three/fiber' {
  interface ThreeElements {
    cadCameraControls: ThreeElement<typeof CADCameraControls>
  }
}

export type CADCameraControlsR3FProps = {
  enabled?: boolean
  enableDamping?: boolean
  dampingFactor?: number
  pivot?: [number, number, number]
  inputBindings?: InputBindings
  touchBindings?: TouchBindings
  rotateSpeed?: number
  panSpeed?: number
  zoomSpeed?: number
  minDistance?: number
  maxDistance?: number
  preventContextMenu?: boolean
}

export function CADCameraControlsR3F( props: CADCameraControlsR3FProps ) {

  const { camera, gl } = useThree()
  const ref = useRef<CADCameraControls>( null! )

  useEffect( () => {

    ref.current.connect( gl.domElement )
    return () => ref.current.dispose()

  }, [ gl.domElement ] )

  useFrame( ( _, delta ) => ref.current.update( delta ) )

  return <cadCameraControls ref={ref} args={[ camera ]} {...props} />

}
