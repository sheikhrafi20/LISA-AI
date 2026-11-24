export default function AvatarLighting() {
  return (
    <>
      {/* Soft white studio: a warm key, a cool fill, and violet rim lights from behind. */}
      <hemisphereLight args={['#ffffff', '#d9ddee', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[1.5, 2.4, 2.6]} intensity={2.2} color="#fff3e8" />
      <directionalLight position={[-2, 1.2, 1.6]} intensity={0.8} color="#dfe6ff" />
      <directionalLight position={[-1.6, 2, -2]} intensity={1.6} color="#8b7cf6" />
      <directionalLight position={[1.8, 1.6, -2]} intensity={1.1} color="#a99cff" />
    </>
  )
}
