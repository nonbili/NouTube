import { expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { NO_AD_PLAYER_PARAMS, noAdPlayerRequestBody, noAdWatchUrl } from '../desktop/src/main/lib/no-ad-request'

it('asks for a playback without ads on full watch page loads only', () => {
  expect(noAdWatchUrl('https://www.youtube.com/watch?v=abc&pp=old&t=5')).toBe(
    `https://www.youtube.com/watch?v=abc&pp=${NO_AD_PLAYER_PARAMS}&t=5`,
  )
  expect(noAdWatchUrl('https://www.youtube.com/')).toBeNull()
  expect(noAdWatchUrl('https://www.youtube.com/watch_videos?v=abc')).toBeNull()
})

it('sets the player params in gzipped get_watch and plain player bodies', () => {
  const watch = { context: { client: {} }, playerRequest: { videoId: 'abc', params: 'x' }, watchNextRequest: {} }
  const fromWatch = JSON.parse(noAdPlayerRequestBody('get_watch', gzipSync(JSON.stringify(watch)), 'gzip')!)
  expect(fromWatch).toEqual({ ...watch, playerRequest: { videoId: 'abc', params: NO_AD_PLAYER_PARAMS } })

  const player = { context: {}, videoId: 'abc' }
  const fromPlayer = JSON.parse(noAdPlayerRequestBody('player', new TextEncoder().encode(JSON.stringify(player)), null)!)
  expect(fromPlayer).toEqual({ ...player, params: NO_AD_PLAYER_PARAMS })
})

it('leaves get_watch bodies without a player request alone', () => {
  expect(noAdPlayerRequestBody('get_watch', new TextEncoder().encode('{"context":{}}'), null)).toBeNull()
})
