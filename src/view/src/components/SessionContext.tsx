import React from 'react'
import { createContext, useContext, useState } from 'react'

const SessionContext = createContext( null )

interface Session {
  user_id: string
}

export function SessionProvider( { children }: React.ReactNode ) {
  const [ user, set_user ] = useState<Session | null>( null )

  const login = ( user_data: Session ) => set_user( user_data )
  const logout = () => set_user( null )

  return (
    <SessionContext.Provider value={{ user, login, logout }}>
      { children }
    </SessionContext.Provider>
  );
}

export function use_sesssion() {
  const context = useContext( SessionContext )
  if ( !context ) throw new Error( "useSession must be used within a SessionProvider" )
  return context
}
