class SessionStore {
	public sessions = new Map();
	public saveSesion(sessionID: string, session: any) {
		this.sessions.set(sessionID, session);
	}
	public findSession(sessionID: string) {
		return this.sessions.get(sessionID);
	}
	public findAllSession() {
		return [...this.sessions.values()];
	}
}

export default SessionStore;
