import { Socket } from "socket.io/dist";
import Room from "../classes/room";
import Server from "../classes/server";
import Song from "../classes/song";
import Playlist from "../classes/playlist";


export function handleCreatePlaylist(t: Server, socket: Socket, room_id: string, name: string, song_ids: string[]) {
    console.log(`Device ${socket.id} is attempting to create a playlist named ${name} in ${room_id} wuth ${song_ids.length} songs.`)
    const room: Room | undefined = t.rooms.find((element: Room) => element.id === room_id);
    if (room === undefined) {
        socket.emit("error","Room not found");
        return;
    }
    const members: Socket[] = room!.getMembers();
        if (members.find(member => member.id === socket.id) === undefined) {
        socket.emit("error","User has not joined this room");
        return;
    }
    // create the playlist and get the songs
    const playlist = new Playlist(name);
    for (const song_id of song_ids) {
        const song = room.songs.find((element: Song) => element.id === song_id);
        if (song === undefined) {
            socket.emit("error",`song ${song_id} does not exist`);
            continue;
        }
        playlist.addSong(song)
    }
    // add the playlist to the room
    room.addPlaylist(playlist);

}