import { useState } from "react";
import Join from "./join";
import Room from "./Room";

function App() {
  const [user, setUser] = useState(null);

  const handleJoin = (data) => {
    console.log("JOIN:", data); // ✅ debug
    setUser({
      username: data.username.trim(),
      roomId: data.roomId.trim(),
    });
  };

  return (
    <>
      {!user ? (
        <Join onJoin={handleJoin} />
      ) : (
        <Room
          roomId={user.roomId}
          username={user.username}
        />
      )}
    </>
  );
}

export default App;