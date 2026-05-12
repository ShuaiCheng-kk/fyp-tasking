import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: '#F97316',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '6px 7px',
          gap: 3,
        }}
      >
        <div style={{ width: 18, height: 3, background: 'white', borderRadius: 2 }} />
        <div style={{ width: 14, height: 3, background: 'white', borderRadius: 2 }} />
        <div style={{ width: 10, height: 3, background: 'white', borderRadius: 2 }} />
      </div>
    ),
    { ...size }
  )
}
