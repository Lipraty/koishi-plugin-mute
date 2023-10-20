import { Context, Schema, Session } from 'koishi'

declare module 'koishi' {
  interface Channel {
    mute: boolean
    muteTimer: number
  }
}

export interface Config {
  authority: number
}

export const name = 'mute'

export const Config: Schema<Config> = Schema.object({
  authority: Schema.number().default(4).description('权限等级'),
})

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('channel', {
    mute: 'boolean',
    muteTimer: {
      type: 'integer',
      initial: 0,
    }
  })

  ctx.command('mute', { authority: config.authority })
    .alias('禁音')
    .option('time', '-t <time:number>')
    .channelFields(['mute', 'muteTimer'])
    .action(async ({ session, options }) => {
      if (session.isDirect) return session.text('direct')
      const { time } = options
      if (time > 3600) return session.text('too-long')
      session.channel.mute = true
      session.channel.muteTimer = time ? (Date.now() + (time * 60 * 1000)) : 0
      return session.text('success') + (time ? session.text('time', { time }) : '')
    })
  ctx.command('unmute', { authority: config.authority })
    .alias('解除禁音')
    .channelFields(['mute', 'muteTimer'])
    .action(async ({ session }) => {
      if (session.isDirect) return session.text('direct')
      if (!session.channel.mute) return session.text('not-muted')
      session.channel.mute = false
      session.channel.muteTimer = 0
      return session.text('success')
    })

  ctx.before('attach-channel', (_, f) => {
    f.add('mute')
      .add('muteTimer')
  })

  ctx.before('send', async ({ channelId, platform, guildId }) => {
    const [data] = await ctx.database.get('channel', { id: channelId, platform, guildId }, ['mute', 'muteTimer'])
    const { mute, muteTimer } = data
    if (muteTimer && muteTimer !== 0 && Date.now() > muteTimer) {
      await ctx.database.set('channel', { id: channelId, platform, guildId }, { mute: false, muteTimer: 0 })
    }
    if (mute) return false
  }, true)
}
