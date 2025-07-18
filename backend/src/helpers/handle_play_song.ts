import { Socket } from "socket.io";
import Room from "../classes/room";
import Server from "../classes/server";
import Song from "../classes/song";

export function handlePlaySong(t: Server, socket: Socket, room_id: string, song_id: string) {

    console.log(`Device ${socket.id} is requesting song ${song_id} from room ${room_id}`)
    const room: Room | undefined = t.rooms.find((element) => element.id === room_id);
    if (room === undefined) {
        socket.emit("error","Room not found");
        return;
    }
    const members = room!.getMembers();
    if (members.find(member => member.id === socket.id) === undefined) {
        socket.emit("error","User has not joined this room");
        return;
    }
    const song = room.songs.find((element: Song) => element.id === song_id);
    if (song === undefined) {
        socket.emit("error","This song does not exist");
    }
    // add in compression
    const buf = song!.getBuffer();

    t.rpc.setActivity({
        // @ts-expect-error
        type: 2,
        details: `Playing ${song.metadata.common.title}`,
        state: `by ${song.metadata.common.artist}`,
        startTimestamp: new Date(),
        instance: false,
    })
    let chunkSize = (buf.byteLength / song.metadata.format.duration) * 5
    let total_chunks = Math.ceil(buf.byteLength / chunkSize);
    let timeoutId: NodeJS.Timeout | null = null;
    console.log(`Song: ${song.metadata.common.title} by ${song.metadata.common.artist} with a chunk size of ${chunkSize} and bytelength of ${buf.byteLength} making ${total_chunks} total chunks`)
    console.log("Exporting song data");
    const data = song.exportSong();
    socket.emit("status","playing song")
    console.log(`Sending song data start event for song ${song_id} to device ${socket.id}`);
    socket.emit("song data start",data,total_chunks)
    socket.on('stop song', (id: string) => {
        console.log(`Device ${socket.id} has requested to stop song ${song_id}`);
        if (id === song_id) {
            console.log(`Device ${socket.id} has stopped song ${song_id}`);
            clearTimeout(timeoutId);
            isCancelled = true;
            socket.emit("status","stopped song");
            socket.off(`song data ready ${song_id}`, sendSongData);
            socket.removeAllListeners(`stop song`);
        }
    });

    let isCancelled = false;

    const sendSongData = () => {
        socket.removeAllListeners(`song data ready ${song_id}`);
        let offset = 0;
        let chunk_counter = 0;
        console.log(`Device ${socket.id} is ready to receive song data for ${song_id}`);

        const sendChunk = () => {
            if (isCancelled) return; 
            if (offset < buf.byteLength) {
                const remainingSize = buf.byteLength - offset;
                if (remainingSize < chunkSize) chunkSize = remainingSize
                const chunk = buf.slice(offset, Math.min(offset + chunkSize, buf.byteLength));
                socket.emit(`song data ${song_id}`, {buffer: chunk, chunk_counter});
                offset += chunkSize;
                chunk_counter += 1;
                console.log(`Sending chunk ${chunk_counter} out of ${total_chunks} of song ${song_id}`);
                timeoutId = setTimeout(sendChunk, 0); // Use setTimeout to avoid blocking the event loop
            } else {
                console.log("Finished sending song data");
                socket.emit("song data end");
                
            }
        };

        sendChunk();
    };

    // Add new listeners
    console.log(`Waiting for device ${socket.id} to be ready to receive song data for song ${song_id}`);
    socket.on(`song data ready ${song_id}`, sendSongData);




}


