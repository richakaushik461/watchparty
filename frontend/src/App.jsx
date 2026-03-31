import { useState } from "react";
import Join from "./join";
import Room from "./Room";

function App() {
  const [user, setUser] = useState(null);

  return (
    <>
      {!user ? (
        <Join onJoin={setUser} />
      ) : (
        <Room
          roomId={user.roomId}
          username={user.username}
          role={user.role}
        />
      )}
    </>
  );
}

export default App;