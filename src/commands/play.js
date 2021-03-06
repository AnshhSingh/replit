const { Util } = require("discord.js");
const yts = require("yt-search");
const ytdl = require("ytdl-core");

module.exports = {
  name: "play",
  description: "Play command.",
  usage: "[command name]",
  args: true,
  cooldown: 5,
  async execute(message, args) {
    const { channel } = message.member.voice;
    if (!channel)
      return message.channel.send(
        "I'm sorry but you need to be in a voice channel to play music!"
      );
    const permissions = channel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT"))
      return message.channel.send(
        "I cannot connect to your voice channel, make sure I have the proper permissions!"
      );
    if (!permissions.has("SPEAK"))
      return message.channel.send(
        "I cannot speak in this voice channel, make sure I have the proper permissions!"
      );
    let vid = await yts(args.join(" "));
    vid = vid.all[0].videoId;

    if (!vid)
      return message.channel.send(
        "I could not find any videos that match that title"
      );

    const serverQueue = message.client.queue.get(message.guild.id);
    const queue = message.client.queue.get(message.guild.id);
    const songInfo = await ytdl.getInfo(vid.replace(/<(.+)>/g, "$1"));
    const song = {
      id: songInfo.videoDetails.video_id,
      title: Util.escapeMarkdown(songInfo.videoDetails.title),
      url: songInfo.videoDetails.video_url
    };

    if (serverQueue) {
      serverQueue.songs.push(song);
      console.log(serverQueue.songs);
      return message.channel.send(
        `✅ **${song.title}** has been added to the queue!`
      );
    }

    const queueConstruct = {
      textChannel: message.channel,
      voiceChannel: channel,
      connection: null,
      songs: [],
      volume: 2,
      playing: true
    };
    message.client.queue.set(message.guild.id, queueConstruct);
    queueConstruct.songs.push(song);

    const play = async song => {
      const queue = message.client.queue.get(message.guild.id);
      if (!song) {
        queue.voiceChannel.leave();
        message.client.queue.delete(message.guild.id);
        return;
      }

      const dispatcher = queue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
          queue.songs.shift();
          play(queue.songs[0], {filter: "audioonly"});
        })
        .on("error", error => console.error(error));
      dispatcher.setVolumeLogarithmic(queue.volume / 5);
      queue.textChannel.send(`🎶 Started playing: **${song.title}**`);
    };

    try {
      const connection = await channel.join();
      queueConstruct.connection = connection;
      play(queueConstruct.songs[0]);
    } catch (error) {
      console.error(`I could not join the voice channel: ${error}`);
      message.client.queue.delete(message.guild.id);
      await channel.leave();
      return message.channel.send(
        `I could not join the voice channel: ${error}`
      );
    }
  }
};
