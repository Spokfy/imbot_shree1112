const mineflayer = require('mineflayer')
const cmd = require('mineflayer-cmd').plugin
const fs = require('fs');
let rawdata = fs.readFileSync('config.json');
let data = JSON.parse(rawdata);
var lasttime = -1;
var moving = 0;
var connected = 0;
var actions = [ 'forward', 'back', 'left', 'right']
var lastaction;
var pi = 3.14159;
var moveinterval = 2; // 2 second movement interval
var maxrandom = 5; // 0-5 seconds added to movement interval (randomly)
var host = data["ip"];
var username = data["name"]
var nightskip = data["auto-night-skip"]
var bot = mineflayer.createBot({
  host: host,
  username: username
});
function getRandomArbitrary(min, max) {
       return Math.random() * (max - min) + min;

}

bot.loadPlugin(cmd)



bot.on('login',function(){
	console.log("Logged In")
	bot.chat("suno...me ez in server");
});

bot.on('time', function(time) {
	if(nightskip == "false"){
	if(bot.time.timeOfDay >= 1000	){
	bot.chat('Sleep')
	}}
    if (connected <1) {
        return;
    }
    if (lasttime<0) {
        lasttime = bot.time.age;
    } else {
        var randomadd = Math.random() * maxrandom * 20;
        var interval = moveinterval*40 + randomadd;
        if (bot.time.age - lasttime > interval) {
            if (moving == 1) {
                bot.setControlState(lastaction,false);
                moving = 3;
                lasttime = bot.time.age;
            } else {
                var yaw = Math.random()*pi - (0.5*pi);
                var pitch = Math.random()*pi - (0.5*pi);
                bot.look(yaw,pitch,false);
                lastaction = actions[Math.floor(Math.random() * actions.length)];
                bot.setControlState(lastaction,true);
                moving = 1;
                lasttime = bot.time.age;
                bot.activateItem();
            }
        }
    }
});

bot.on('spawn',function() {
    connected=1;
});

bot.on('death',function() {
    bot.emit("respawn")
});

bot.on('death',function() {
   bot.chat("how i died???")
});

module.exports = inject

function inject (bot) {
  bot.isAlive = false

  bot._client.on('respawn', (packet) => {
    bot.isAlive = false
    bot.emit('respawn')
  })

  bot._client.on('update_health', (packet) => {
    bot.health = packet.health
    bot.food = packet.food
    bot.foodSaturation = packet.foodSaturation
    bot.emit('health')
    if (bot.health <= 0) {
      bot.isAlive = false
      bot.emit('death')
      bot._client.write('client_command', { payload: 0 })
    } else if (bot.health > 0 && !bot.isAlive) {
      bot.isAlive = true
      bot.emit('spawn')
    }
  })
}
const assert = require('assert')

module.exports = inject

const QUICK_BAR_COUNT = 9
const QUICK_BAR_START = 36

const armorSlots = {
  head: 5,
  torso: 6,
  legs: 7,
  feet: 8
}

function noop (err) {
  if (err) throw err
}

function inject (bot, { version }) {
  const windows = require('prismarine-windows')(version).windows

  let nextQuickBarSlot = 0

  function tossStack (item, cb = noop) {
    assert.ok(item)
    bot.clickWindow(item.slot, 0, 0, (err) => {
      if (err) return cb(err)
      bot.clickWindow(-999, 0, 0, cb)
      bot.closeWindow(bot.currentWindow || bot.inventory)
    })
  }

  function toss (itemType, metadata, count, cb) {
    const window = bot.currentWindow || bot.inventory
    const options = {
      window,
      itemType,
      metadata,
      count,
      sourceStart: window.inventorySlotStart,
      sourceEnd: window.inventorySlotStart + windows.INVENTORY_SLOT_COUNT,
      destStart: -999
    }
    bot.transfer(options, cb)
  }

  function unequip (destination, cb = noop) {
    if (destination === 'hand') {
      equipEmpty(cb)
    } else {
      disrobe(destination, cb)
    }
  }

  function setQuickBarSlot (slot) {
    assert.ok(slot >= 0)
    assert.ok(slot < 9)
    if (bot.quickBarSlot === slot) return
    bot.quickBarSlot = slot
    bot._client.write('held_item_slot', {
      slotId: slot
    })
    bot.updateHeldItem()
  }

  function equipEmpty (cb) {
    for (let i = 0; i < 9; ++i) {
      if (!bot.inventory.slots[QUICK_BAR_START + i]) {
        setQuickBarSlot(i)
        process.nextTick(cb)
        return
      }
    }
    const slot = bot.inventory.firstEmptyInventorySlot()
    if (!slot) {
      bot.tossStack(bot.heldItem, cb)
      return
    }
    const equipSlot = QUICK_BAR_START + bot.quickBarSlot
    bot.clickWindow(equipSlot, 0, 0, (err) => {
      if (err) return cb(err)
      bot.clickWindow(slot, 0, 0, (err) => {
        if (err) return cb(err)
        if (bot.inventory.selectedItem) {
          bot.clickWindow(-999, 0, 0, cb)
        } else {
          cb()
        }
      })
    })
  }

  function disrobe (destination, cb) {
    assert.equal(bot.currentWindow, null)
    const destSlot = getDestSlot(destination)
    bot.putAway(destSlot, cb)
  }

  function equip (item, destination, cb = noop) {
    if (typeof item === 'number') {
      item = bot.inventory.findInventoryItem(item)
    }
    if (item == null || typeof item !== 'object') {
      return cb(new Error('Invalid item object in equip'))
    }
    const sourceSlot = item.slot
    let destSlot = getDestSlot(destination)

    if (sourceSlot === destSlot) {
      // don't need to do anything
      process.nextTick(cb)
      return
    }

    if (destSlot >= QUICK_BAR_START && sourceSlot >= QUICK_BAR_START) {
      // all we have to do is change the quick bar selection
      bot.setQuickBarSlot(sourceSlot - QUICK_BAR_START)
      process.nextTick(cb)
      return
    }

    if (destination !== 'hand') {
      bot.moveSlotItem(sourceSlot, destSlot, cb)
      return
    }

    // find an empty slot on the quick bar to put the source item in
    destSlot = bot.inventory.firstEmptySlotRange(QUICK_BAR_START, QUICK_BAR_START + QUICK_BAR_COUNT)
    if (destSlot == null) {
      // LRU cache for the quick bar items
      destSlot = QUICK_BAR_START + nextQuickBarSlot
      nextQuickBarSlot = (nextQuickBarSlot + 1) % QUICK_BAR_COUNT
    }
    setQuickBarSlot(destSlot - QUICK_BAR_START)
    bot.moveSlotItem(sourceSlot, destSlot, cb)
  }

  function getDestSlot (destination) {
    if (destination === 'hand') {
      return QUICK_BAR_START + bot.quickBarSlot
    } else {
      const destSlot = armorSlots[destination]
      assert.ok(destSlot != null, `invalid destination: ${destination}`)
      return destSlot
    }
  }

  bot.equip = equip
  bot.unequip = unequip
  bot.toss = toss
  bot.tossStack = tossStack
  bot.setQuickBarSlot = setQuickBarSlot

  // constants
  bot.QUICK_BAR_START = QUICK_BAR_START
}

/*
 * This example demonstrates how easy it is to create a bot
 * that sends chat messages whenever something interesting happens
 * on the server you are connected to.
 *
 * Below you can find a wide range of different events you can watch
 * but remember to check out the API documentation to find even more!
 *
 * Some events may be commented out because they are very frequent and
 * may flood the chat, feel free to check them out for other purposes though.
 *
 * This bot also replies to some specific chat messages so you can ask him
 * a few informations while you are in game.
 */
const mineflayer = require('mineflayer')
const Vec3 = require('vec3').Vec3

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log('Usage : node chatterbot.js <host> <port> [<name>] [<password>]')
  process.exit(1)
}

const bot = mineflayer.createBot({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : 'chatterbox',
  password: process.argv[5],
  verbose: true
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return
  const result = /canSee (-?[0-9]+),(-?[0-9]+),(-?[0-9]+)/.exec(message)
  if (result) {
    canSee(new Vec3(result[1], result[2], result[3]))
    return
  }
  switch (message) {
    case 'pos':
      sayPosition(username)
      break
    case 'wearing':
      sayEquipment()
      break
    case 'spawn':
      saySpawnPoint()
      break
    case 'block':
      sayBlockUnder(username)
      break
    case 'quit':
      quit(username)
      break
    default:
      bot.chat("That's nice")
  }

  function canSee (pos) {
    const block = bot.blockAt(pos)
    const r = bot.canSeeBlock(block)
    if (r) {
      bot.chat(`I can see the block of ${block.displayName} at ${pos}`)
    } else {
      bot.chat(`I cannot see the block of ${block.displayName} at ${pos}`)
    }
  }

  function sayPosition (username) {
    bot.chat(`I am at ${bot.entity.position}`)
    bot.chat(`You are at ${bot.players[username].entity.position}`)
  }

  function sayEquipment () {
    const eq = bot.players[username].entity.equipment
    const eqText = []
    if (eq[0]) eqText.push(`holding a ${eq[0].displayName}`)
    if (eq[1]) eqText.push(`wearing a ${eq[1].displayName} on your feet`)
    if (eq[2]) eqText.push(`wearing a ${eq[2].displayName} on your legs`)
    if (eq[3]) eqText.push(`wearing a ${eq[3].displayName} on your torso`)
    if (eq[4]) eqText.push(`wearing a ${eq[4].displayName} on your head`)
    if (eqText.length) {
      bot.chat(`You are ${eqText.join(', ')}.`)
    } else {
      bot.chat('You are naked!')
    }
  }

  function saySpawnPoint () {
    bot.chat(`Spawn is at ${bot.spawnPoint}`)
  }

  function sayBlockUnder () {
    const block = bot.blockAt(bot.players[username].entity.position.offset(0, -1, 0))
    bot.chat(`Block under you is ${block.displayName} in the ${block.biome.name} biome`)
    console.log(block)
  }

  function quit (username) {
    bot.quit(`${username} told me to`)
  }
})

bot.on('whisper', (username, message, rawMessage) => {
  console.log(`I received a message from ${username}: ${message}`)
  bot.whisper(username, 'I can tell secrets too.')
})
bot.on('nonSpokenChat', (message) => {
  console.log(`Non spoken chat: ${message}`)
})

bot.on('login', () => {
  bot.chat('Hi everyone!')
})
bot.on('spawn', () => {
  bot.chat('I spawned, watch out!')
})
bot.on('spawnReset', (message) => {
  bot.chat('Oh noez! My bed is broken.')
})
bot.on('forcedMove', () => {
  bot.chat(`I have been forced to move to ${bot.entity.position}`)
})
bot.on('health', () => {
  bot.chat(`I have ${bot.health} health and ${bot.food} food`)
})
bot.on('death', () => {
  bot.chat('I died x.x')
})
bot.on('kicked', (reason) => {
  console.log(`I got kicked for ${reason}`)
})

bot.on('time', () => {
  // bot.chat("Current time: " + bot.time.day % 24000);
})
bot.on('rain', () => {
  if (bot.isRaining) {
    bot.chat('It started raining.')
  } else {
    bot.chat('It stopped raining.')
  }
})
bot.on('noteHeard', (block, instrument, pitch) => {
  bot.chat(`Music for my ears! I just heard a ${instrument.name}`)
})
bot.on('chestLidMove', (block, isOpen) => {
  const action = isOpen ? 'open' : 'close'
  bot.chat(`Hey, did someone just ${action} a chest?`)
})
bot.on('pistonMove', (block, isPulling, direction) => {
  const action = isPulling ? 'pulling' : 'pushing'
  bot.chat(`A piston is ${action} near me, i can hear it.`)
})

bot.on('playerJoined', (player) => {
  if (player.username !== bot.username) {
    bot.chat(`Hello, ${player.username}! Welcome to the server.`)
  }
})
bot.on('playerLeft', (player) => {
  if (player.username === bot.username) return
  bot.chat(`Bye ${player.username}`)
})
bot.on('playerCollect', (collector, collected) => {
  if (collector.type === 'player' && collected.type === 'object') {
    const rawItem = collected.metadata[10]
    const item = mineflayer.Item.fromNotch(rawItem)
    bot.chat(`${collector.username !== bot.username ? ("I'm so jealous. " + collector.username) : 'I '} collected ${item.count} ${item.displayName}`)
  }
})

bot.on('entitySpawn', (entity) => {
  if (entity.type === 'mob') {
    console.log(`Look out! A ${entity.mobType} spawned at ${entity.position}`)
  } else if (entity.type === 'player') {
    bot.chat(`Look who decided to show up: ${entity.username}`)
  } else if (entity.type === 'object') {
    bot.chat(`There's a ${entity.objectType} at ${entity.position}`)
  } else if (entity.type === 'global') {
    bot.chat('Ooh lightning!')
  } else if (entity.type === 'orb') {
    bot.chat('Gimme dat exp orb!')
  }
})
bot.on('entityHurt', (entity) => {
  if (entity.type === 'mob') {
    bot.chat(`Haha! The ${entity.mobType} got hurt!`)
  } else if (entity.type === 'player') {
    bot.chat(`Aww, poor ${entity.username} got hurt. Maybe you shouldn't have a ping of ${bot.players[entity.username].ping}`)
  }
})
bot.on('entitySwingArm', (entity) => {
  bot.chat(`${entity.username}, I see that your arm is working fine.`)
})
bot.on('entityCrouch', (entity) => {
  bot.chat(`${entity.username}: you so sneaky.`)
})
bot.on('entityUncrouch', (entity) => {
  bot.chat(`${entity.username}: welcome back from the land of hunchbacks.`)
})
bot.on('entitySleep', (entity) => {
  bot.chat(`Good night, ${entity.username}`)
})
bot.on('entityWake', (entity) => {
  bot.chat(`Top of the morning, ${entity.username}`)
})
bot.on('entityEat', (entity) => {
  bot.chat(`${entity.username}: OM NOM NOM NOMONOM. That's what you sound like.`)
})
bot.on('entityAttach', (entity, vehicle) => {
  if (entity.type === 'player' && vehicle.type === 'object') {
    bot.chat(`Sweet, ${entity.username} is riding that ${vehicle.objectType}`)
  }
})
bot.on('entityDetach', (entity, vehicle) => {
  if (entity.type === 'player' && vehicle.type === 'object') {
    bot.chat(`Lame, ${entity.username} stopped riding the ${vehicle.objectType}`)
  }
})
bot.on('entityEquipmentChange', (entity) => {
  console.log('entityEquipmentChange', entity)
})
bot.on('entityEffect', (entity, effect) => {
  console.log('entityEffect', entity, effect)
})
bot.on('entityEffectEnd', (entity, effect) => {
  console.log('entityEffectEnd', entity, effect)
})