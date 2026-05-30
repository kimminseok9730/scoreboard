import { useState, useEffect, useRef } from 'react'
import './App.css'
import { playBuzzer, unlockAudio } from './sounds.js'

const DEFAULT_MATCH = (id) => ({
  id,
  homeTeam: '홈팀',
  awayTeam: '원정팀',
  homeScore: 0,
  awayScore: 0,
  homeColor: '#7c3aed',
  awayColor: '#0369a1',
  quarters: 4,
  quarterDuration: 600,
  breakDuration: 300,
  currentQuarter: 1,
  phase: 'pregame',
  time: 0,
  running: false,
  timeoutDuration: 30,
  homeTimeouts: 3,
  awayTimeouts: 3,
  homeTimeoutsUsed: 0,
  awayTimeoutsUsed: 0,
  timeoutActive: false,
  timeoutRemaining: 0,
  timerWasRunning: false,
  // lead tracking
  reversalTeam: null,      // 'home' | 'away' | null
  lastNonTieLeader: null,  // 마지막으로 앞섰던 팀 (동점 구간 무시)
})

function getLeader(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'tie'
}

export default function App() {
  const [matches, setMatches] = useState([DEFAULT_MATCH(1)])
  const [activeId, setActiveId] = useState(1)
  const [nextId, setNextId] = useState(2)
  const intervals = useRef({})
  const pendingStop = useRef({})

  // 어떤 클릭이든 AudioContext unlock — 브라우저 자동재생 정책 우회
  useEffect(() => {
    const handler = () => unlockAudio()
    document.addEventListener('click', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  useEffect(() => () => Object.values(intervals.current).forEach(clearInterval), [])

  function updateMatch(id, changes) {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m))
  }

  function changeScore(id, team, delta) {
    unlockAudio()
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m
      const key = team === 'home' ? 'homeScore' : 'awayScore'
      const newVal = Math.max(0, m[key] + delta)
      const newHome = team === 'home' ? newVal : m.homeScore
      const newAway = team === 'away' ? newVal : m.awayScore

      const newLeader = getLeader(newHome, newAway)
      // lastNonTieLeader: 현재 leading 팀이 있으면 갱신, 동점이면 이전 값 유지
      const currentLeader = getLeader(m.homeScore, m.awayScore)
      const newLastNonTie = currentLeader !== 'tie' ? currentLeader : m.lastNonTieLeader

      // 역전: 새 리더가 팀이고, 직전 비동점 리더가 반대 팀일 때
      const isReversal = newLeader !== 'tie' && newLastNonTie !== null && newLeader !== newLastNonTie

      // 역전 팀이 추가 득점 → 리드로 전환
      const clearReversal = !isReversal && m.reversalTeam && newLeader === m.reversalTeam

      return {
        ...m,
        [key]: newVal,
        lastNonTieLeader: newLastNonTie,
        reversalTeam: isReversal ? newLeader : clearReversal ? null : m.reversalTeam,
      }
    }))
  }

  function swapTeamsData(m) {
    return {
      homeTeam: m.awayTeam, awayTeam: m.homeTeam,
      homeScore: m.awayScore, awayScore: m.homeScore,
      homeColor: m.awayColor, awayColor: m.homeColor,
      homeTimeouts: m.awayTimeouts, awayTimeouts: m.homeTimeouts,
      homeTimeoutsUsed: m.awayTimeoutsUsed, awayTimeoutsUsed: m.homeTimeoutsUsed,
    }
  }

  function startInterval(id) {
    if (intervals.current[id]) return
    intervals.current[id] = setInterval(() => {
      if (pendingStop.current[id]) {
        clearInterval(intervals.current[id])
        delete intervals.current[id]
        delete pendingStop.current[id]
        return
      }

      let shouldBuzz = false

      setMatches(prev => prev.map(m => {
        if (m.id !== id) return m

        if (m.timeoutActive) {
          const rem = m.timeoutRemaining - 1
          if (rem <= 0) {
            if (!m.timerWasRunning) pendingStop.current[id] = true
            return { ...m, timeoutActive: false, timeoutRemaining: 0, running: m.timerWasRunning }
          }
          return { ...m, timeoutRemaining: rem }
        }

        if (!m.running) return m

        if (m.phase === 'quarter') {
          const newTime = m.time - 1
          if (newTime <= 0) {
            shouldBuzz = true
            if (m.currentQuarter >= m.quarters) {
              pendingStop.current[id] = true
              return { ...m, time: 0, running: false, phase: 'done' }
            }
            return { ...m, ...swapTeamsData(m), time: m.breakDuration, phase: 'break' }
          }
          return { ...m, time: newTime }
        }

        if (m.phase === 'break') {
          const newTime = m.time - 1
          if (newTime <= 0) {
            shouldBuzz = true
            pendingStop.current[id] = true
            return { ...m, time: m.quarterDuration, phase: 'quarter', currentQuarter: m.currentQuarter + 1, running: false }
          }
          return { ...m, time: newTime }
        }

        return m
      }))

      if (shouldBuzz) playBuzzer()
    }, 1000)
  }

  function stopInterval(id) {
    clearInterval(intervals.current[id])
    delete intervals.current[id]
  }

  function startGame(id) {
    unlockAudio()
    setMatches(prev => prev.map(m => m.id !== id ? m : {
      ...m, phase: 'quarter', time: m.quarterDuration, running: true,
      currentQuarter: 1, homeScore: 0, awayScore: 0,
      homeTimeoutsUsed: 0, awayTimeoutsUsed: 0,
      reversalTeam: null, lastNonTieLeader: null,
    }))
    startInterval(id)
  }

  function toggleTimer(id) {
    unlockAudio()
    const match = matches.find(m => m.id === id)
    if (!match || match.timeoutActive) return
    if (match.running) {
      stopInterval(id)
      updateMatch(id, { running: false })
    } else {
      updateMatch(id, { running: true })
      startInterval(id)
    }
  }

  function resetGame(id) {
    stopInterval(id)
    setMatches(prev => prev.map(m => m.id !== id ? m : {
      ...m, phase: 'pregame', time: 0, running: false,
      currentQuarter: 1, homeScore: 0, awayScore: 0,
      homeTimeoutsUsed: 0, awayTimeoutsUsed: 0,
      timeoutActive: false, timeoutRemaining: 0,
      reversalTeam: null, lastNonTieLeader: null,
    }))
  }

  function callTimeout(id, team) {
    unlockAudio()
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m
      const usedKey = team === 'home' ? 'homeTimeoutsUsed' : 'awayTimeoutsUsed'
      const totalKey = team === 'home' ? 'homeTimeouts' : 'awayTimeouts'
      if (m[usedKey] >= m[totalKey] || m.timeoutActive) return m
      return { ...m, [usedKey]: m[usedKey] + 1, timeoutActive: true, timeoutRemaining: m.timeoutDuration, timerWasRunning: m.running, running: false }
    }))
    startInterval(id)
  }

  function cancelTimeout(id) {
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m
      if (!m.timerWasRunning) stopInterval(id)
      return { ...m, timeoutActive: false, timeoutRemaining: 0, running: m.timerWasRunning }
    }))
  }

  function swapTeams(id) {
    setMatches(prev => prev.map(m => m.id !== id ? m : { ...m, ...swapTeamsData(m) }))
  }

  function addMatch() {
    const id = nextId
    setMatches(prev => [...prev, DEFAULT_MATCH(id)])
    setActiveId(id)
    setNextId(id + 1)
  }

  function removeMatch(id) {
    stopInterval(id)
    setMatches(prev => {
      const next = prev.filter(m => m.id !== id)
      if (activeId === id && next.length > 0) setActiveId(next[0].id)
      return next
    })
  }

  function fmt(secs) {
    const s = Math.max(0, secs)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function parseDuration(str) {
    const parts = str.split(':').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1]
    const n = Number(str)
    return isNaN(n) ? null : n * 60
  }

  const match = matches.find(m => m.id === activeId)
  const isBreak = match?.phase === 'break'

  // Result banner logic
  function renderBanner(m) {
    const leader = getLeader(m.homeScore, m.awayScore)
    if (m.reversalTeam && leader === m.reversalTeam) {
      const name = m.reversalTeam === 'home' ? m.homeTeam : m.awayTeam
      const color = m.reversalTeam === 'home' ? m.homeColor : m.awayColor
      return <span className="reversal" style={{ color }}>🔄 역전! {name}</span>
    }
    if (leader === 'home') return <span style={{ color: m.homeColor }}>🏆 {m.homeTeam} 리드!</span>
    if (leader === 'away') return <span style={{ color: m.awayColor }}>🏆 {m.awayTeam} 리드!</span>
    if (m.homeScore > 0) return <span>⚖️ 동점!</span>
    return <span className="muted">점수 없음</span>
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">⚡ ScoreBoard</h1>
        <div className="tabs">
          {matches.map(m => (
            <button key={m.id} className={`tab ${m.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(m.id)}>
              {m.homeTeam} vs {m.awayTeam}
              {matches.length > 1 && (
                <span className="tab-close" onClick={e => { e.stopPropagation(); removeMatch(m.id) }}>×</span>
              )}
            </button>
          ))}
          <button className="tab add-tab" onClick={addMatch}>+ 경기 추가</button>
        </div>
      </header>

      {match && (
        <main className={`scoreboard ${isBreak ? 'is-break' : ''}`}>

          {/* 승리 화면 — 경기 종료 시 전체 대체 */}
          {match.phase === 'done' && (
            <VictoryScreen match={match} onReset={() => resetGame(match.id)} />
          )}

          {match.phase === 'pregame' && (
            <MatchSettings match={match} updateMatch={updateMatch} parseDuration={parseDuration} fmt={fmt} />
          )}

          {/* Quarter banner */}
          {(match.phase === 'quarter' || match.phase === 'break') && (
            <div className={`quarter-banner ${match.phase}`}>
              <div className="quarter-banner-inner">
                {match.phase === 'quarter' && (
                  <div className="quarter-text">
                    <span className="q-num">{match.currentQuarter}</span>
                    <span className="q-word">QUARTER</span>
                  </div>
                )}
                {match.phase === 'break' && (
                  <div className="quarter-text break">
                    <span className="q-num">BREAK</span>
                    <span className="q-word">{match.currentQuarter}Q 종료 · {match.currentQuarter + 1}Q 준비</span>
                  </div>
                )}
              </div>
              <button className="reset-game-btn" onClick={() => resetGame(match.id)}>↺ 초기화</button>
            </div>
          )}

          {match.timeoutActive && (
            <div className="timeout-banner">
              <span>⏸ 타임아웃 — {fmt(match.timeoutRemaining)}</span>
              <button className="cancel-timeout-btn" onClick={() => cancelTimeout(match.id)}>취소</button>
            </div>
          )}

          {match.phase !== 'done' && <div className="score-area">
            <TeamBlock
              name={match.homeTeam} score={match.homeScore} color={match.homeColor}
              timeoutsTotal={match.homeTimeouts} timeoutsUsed={match.homeTimeoutsUsed}
              onNameChange={v => updateMatch(match.id, { homeTeam: v })}
              onScoreChange={delta => changeScore(match.id, 'home', delta)}
              onTimeout={() => callTimeout(match.id, 'home')}
              timeoutActive={match.timeoutActive}
              isWinning={match.homeScore > match.awayScore}
              inGame={match.phase !== 'pregame'}
            />

            <div className="center">
              <div className={`timer ${match.running ? 'running' : ''} ${match.timeoutActive ? 'timeout' : ''} ${isBreak ? 'break' : ''}`}>
                {match.timeoutActive ? fmt(match.timeoutRemaining) : fmt(match.time)}
              </div>
              <div className="center-controls">
                {match.phase === 'pregame' && (
                  <button className="timer-btn start" onClick={() => startGame(match.id)}>▶ 경기 시작</button>
                )}
                {(match.phase === 'quarter' || match.phase === 'break') && (
                  <button className={`timer-btn ${match.running ? 'stop' : 'start'}`}
                    onClick={() => toggleTimer(match.id)} disabled={match.timeoutActive}>
                    {match.running ? '⏸ 정지' : '▶ 재개'}
                  </button>
                )}
                {match.phase === 'done' && <div className="done-label">🏁 경기 종료</div>}
                <button className="swap-btn" onClick={() => swapTeams(match.id)}>⇄ 팀 스왑</button>
              </div>
            </div>

            <TeamBlock
              name={match.awayTeam} score={match.awayScore} color={match.awayColor}
              timeoutsTotal={match.awayTimeouts} timeoutsUsed={match.awayTimeoutsUsed}
              onNameChange={v => updateMatch(match.id, { awayTeam: v })}
              onScoreChange={delta => changeScore(match.id, 'away', delta)}
              onTimeout={() => callTimeout(match.id, 'away')}
              timeoutActive={match.timeoutActive}
              isWinning={match.awayScore > match.homeScore}
              inGame={match.phase !== 'pregame'}
            />
          </div>}

          {match.phase !== 'done' && (
            <div className="result-banner">{renderBanner(match)}</div>
          )}
        </main>
      )}
    </div>
  )
}

function MatchSettings({ match, updateMatch, parseDuration, fmt }) {
  const id = match.id
  return (
    <div className="settings-panel">
      <h2 className="settings-title">경기 설정</h2>
      <div className="settings-grid">
        <SettingsGroup label="쿼터 수">
          <div className="number-input">
            <button onClick={() => updateMatch(id, { quarters: Math.max(1, match.quarters - 1) })}>−</button>
            <span>{match.quarters}쿼터</span>
            <button onClick={() => updateMatch(id, { quarters: match.quarters + 1 })}>+</button>
          </div>
        </SettingsGroup>

        <SettingsGroup label="쿼터당 시간 (분:초)">
          <input className="settings-input" defaultValue={fmt(match.quarterDuration)}
            onBlur={e => { const s = parseDuration(e.target.value); if (s) updateMatch(id, { quarterDuration: s }) }}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()} placeholder="10:00" />
        </SettingsGroup>

        <SettingsGroup label="쉬는 시간 (분:초)">
          <input className="settings-input" defaultValue={fmt(match.breakDuration)}
            onBlur={e => { const s = parseDuration(e.target.value); if (s) updateMatch(id, { breakDuration: s }) }}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()} placeholder="05:00" />
        </SettingsGroup>

        <SettingsGroup label="타임아웃 (횟수 / 시간)">
          <div className="timeout-settings">
            <div className="number-input small">
              <button onClick={() => updateMatch(id, { homeTimeouts: Math.max(0, match.homeTimeouts - 1), awayTimeouts: Math.max(0, match.awayTimeouts - 1) })}>−</button>
              <span>{match.homeTimeouts}회</span>
              <button onClick={() => updateMatch(id, { homeTimeouts: match.homeTimeouts + 1, awayTimeouts: match.awayTimeouts + 1 })}>+</button>
            </div>
            <span className="divider">/</span>
            <div className="number-input small">
              <button onClick={() => updateMatch(id, { timeoutDuration: Math.max(5, match.timeoutDuration - 5) })}>−</button>
              <span>{match.timeoutDuration}초</span>
              <button onClick={() => updateMatch(id, { timeoutDuration: match.timeoutDuration + 5 })}>+</button>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup label="홈팀 색상">
          <div className="color-row">
            <input type="color" className="color-picker" value={match.homeColor} onChange={e => updateMatch(id, { homeColor: e.target.value })} />
            <span className="color-name">{match.homeTeam}</span>
          </div>
        </SettingsGroup>

        <SettingsGroup label="원정팀 색상">
          <div className="color-row">
            <input type="color" className="color-picker" value={match.awayColor} onChange={e => updateMatch(id, { awayColor: e.target.value })} />
            <span className="color-name">{match.awayTeam}</span>
          </div>
        </SettingsGroup>

        <SettingsGroup label="소리 테스트">
          <button className="sound-test-btn" onClick={() => { unlockAudio(); playBuzzer() }}>
            🔊 경적 테스트
          </button>
        </SettingsGroup>
      </div>
    </div>
  )
}

function SettingsGroup({ label, children }) {
  return (
    <div className="settings-group">
      <label>{label}</label>
      {children}
    </div>
  )
}

function TeamBlock({ name, score, color, timeoutsTotal, timeoutsUsed, onNameChange, onScoreChange, onTimeout, timeoutActive, isWinning, inGame }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef(null)

  useEffect(() => { setDraft(name) }, [name])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() { onNameChange(draft.trim() || name); setEditing(false) }
  const remaining = timeoutsTotal - timeoutsUsed

  return (
    <div className={`team ${isWinning ? 'winning' : ''}`}
      style={{ '--team-color': color, borderColor: isWinning ? color : 'transparent', boxShadow: isWinning ? `0 0 32px ${color}44` : 'none' }}>
      <div className="team-color-bar" style={{ background: color }} />
      {editing ? (
        <input ref={inputRef} className="team-name-input" value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()} style={{ borderColor: color }} />
      ) : (
        <div className="team-name" onClick={() => setEditing(true)}>
          {name} <span className="edit-icon">✏️</span>
        </div>
      )}
      <div className="score" style={{ color }}>{score}</div>
      <div className="score-controls">
        <button className="score-btn plus" style={{ background: color }} onClick={() => onScoreChange(1)}>+</button>
        <button className="score-btn minus" onClick={() => onScoreChange(-1)}>−</button>
      </div>
      {inGame && timeoutsTotal > 0 && (
        <div className="timeout-section">
          <div className="timeout-dots">
            {Array.from({ length: timeoutsTotal }).map((_, i) => (
              <span key={i} className={`timeout-dot ${i < timeoutsUsed ? 'used' : ''}`}
                style={{ background: i < timeoutsUsed ? '#2a2a45' : color }} />
            ))}
          </div>
          <button className="timeout-btn" onClick={onTimeout}
            disabled={remaining === 0 || timeoutActive} style={{ '--btn-color': color }}>
            타임 ({remaining}회)
          </button>
        </div>
      )}
    </div>
  )
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  emoji: ['🏆','⭐','🎉','✨','🎊','🌟'][i % 6],
  left: `${(i * 4.17) % 100}%`,
  delay: `${(i * 0.17) % 2}s`,
  duration: `${2.5 + (i % 4) * 0.6}s`,
}))

function VictoryScreen({ match, onReset }) {
  const isDraw = match.homeScore === match.awayScore
  const winnerSide  = match.homeScore > match.awayScore ? 'home' : 'away'
  const winnerName  = winnerSide === 'home' ? match.homeTeam  : match.awayTeam
  const winnerColor = winnerSide === 'home' ? match.homeColor : match.awayColor
  const loserName   = winnerSide === 'home' ? match.awayTeam  : match.homeTeam
  const winnerScore = winnerSide === 'home' ? match.homeScore : match.awayScore
  const loserScore  = winnerSide === 'home' ? match.awayScore : match.homeScore

  return (
    <div className="victory-screen" style={{ '--win-color': winnerColor }}>
      {PARTICLES.map((p, i) => (
        <span key={i} className="particle"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}>
          {p.emoji}
        </span>
      ))}
      <div className="victory-content">
        {isDraw ? (
          <>
            <div className="victory-draw">무승부</div>
            <div className="victory-final-score" style={{ color: '#888' }}>
              {match.homeScore} — {match.awayScore}
            </div>
          </>
        ) : (
          <>
            <div className="victory-trophy">🏆</div>
            <div className="victory-winner" style={{ color: winnerColor }}>{winnerName}</div>
            <div className="victory-label" style={{ color: winnerColor }}>승리!</div>
            <div className="victory-final-score" style={{ color: winnerColor }}>
              {winnerScore} <span className="score-sep">:</span> {loserScore}
            </div>
            <div className="victory-loser">vs {loserName}</div>
          </>
        )}
        <button className="victory-reset" onClick={onReset}>↺ 다시하기</button>
      </div>
    </div>
  )
}
