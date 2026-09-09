import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCampaign, finishBattle, claimReward, nextEncounter } from '../src/game/campaign';
import { createBattle, stepBattle } from '../src/game/engine';
import { localCompile } from '../src/game/rules';
import { OBSTACLES } from '../src/game/data';

test('a legitimate four-encounter campaign earns and executes the dodge-counter-rally build', () => {
  const campaign = newCampaign();
  const rewards = ['学会躲避重击', '闪避反击', '协同追击'];
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(campaign.stage, stage);
    assert.equal(campaign.heroes.guard.upgrades.length, stage);
    if (stage > 0) {
      campaign.heroes.assassin.strategy = localCompile('strategy', '优先攻击后排', 'assassin').strategy!;
    }
    const battle = createBattle(campaign);
    battle.phase = 'running';
    for (let frame = 0; frame < 3601 && battle.phase === 'running'; frame++) {
      stepBattle(battle, 1 / 30);
      for (const unit of battle.units.filter(u => u.hp > 0)) {
        assert.ok(Number.isFinite(unit.x) && Number.isFinite(unit.y), `${unit.id} has finite coordinates`);
        assert.ok(unit.x >= 35 && unit.x <= 865 && unit.y >= 56 && unit.y <= 480, `${unit.id} remains in arena`);
        assert.ok(!OBSTACLES.some(o => unit.x > o.x - 16 && unit.x < o.x + o.w + 16 && unit.y > o.y - 16 && unit.y < o.y + o.h + 16), `${unit.id} remains outside pillar collision bounds`);
      }
    }
    assert.equal(battle.phase, 'victory', `encounter ${stage + 1} is winnable with normally earned rewards`);
    finishBattle(campaign, 'victory');
    assert.equal(campaign.wins, stage + 1);
    if (stage < 3) {
      const reward = localCompile('upgrade', rewards[stage], 'guard');
      claimReward(campaign, reward);
      assert.throws(() => claimReward(campaign, reward), 'each victory grants only one reward');
      nextEncounter(campaign);
    } else {
      assert.ok((battle.dodges.guard || 0) > 0, 'the learned dodge activates against the boss');
      assert.ok(battle.events.some(e => e.type === 'counter' && e.actor === 'guard'), 'a successful dodge leads to a counterattack');
      assert.ok(battle.events.some(e => e.type === 'info' && e.text.includes('协同追击')), 'the full earned build rallies the party');
      assert.equal(campaign.rewardAvailable, false);
    }
  }
  assert.deepEqual(campaign.heroes.guard.upgrades, ['dodge', 'counter', 'rally']);
  assert.equal(campaign.outcome, 'victory');
});
