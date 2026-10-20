import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleAmount, parseServings } from '../shared/scale.js';
import { splitIngredientLine, parseStepsText, findTimers } from '../shared/ingredients.js';
import { parseRecipeHtml, isoDurationToMinutes } from '../shared/parseRecipe.js';

test('分量の換算', () => {
  const cases = [
    ['200g', 2, '400g'],
    ['200g', 1.5, '300g'],
    ['150g', 0.5, '75g'],
    ['大さじ1と1/2', 2, '大さじ3'],
    ['大さじ1', 1.5, '大さじ1と1/2'],
    ['小さじ1/2', 2, '小さじ1'],
    ['小さじ1', 0.5, '小さじ1/2'],
    ['1/2個', 2, '1個'],
    ['1個', 0.5, '1/2個'],
    ['2本', 1.5, '3本'],
    ['1〜2本', 2, '2~4本'],
    ['少々', 3, '少々'],
    ['適量', 2, '適量'],
    ['２００ｇ', 2, '400g'],
    ['大さじ½', 2, '大さじ1'],
    ['1カップ', 1/3, '1/3カップ'],
    ['18cmの鍋', 2, '18cmの鍋'],
    ['300ml', 0.5, '150ml'],
    ['1片', 1, '1片']
  ];
  for (const [input, factor, expected] of cases) {
    assert.equal(scaleAmount(input, factor), expected, `${input} ×${factor}`);
  }
});

test('人数の読み取り', () => {
  assert.equal(parseServings('2人分'), 2);
  assert.equal(parseServings(['4', '4人分']), 4);
  assert.equal(parseServings('２〜３人分'), 2);
  assert.equal(parseServings('4 servings'), 4);
  assert.equal(parseServings('不明'), null);
});

test('材料行の分割', () => {
  const cases = [
    ['玉ねぎ　1/2個', { name: '玉ねぎ', amount: '1/2個' }],
    ['豚バラ薄切り肉 200g', { name: '豚バラ薄切り肉', amount: '200g' }],
    ['醤油…大さじ2', { name: '醤油', amount: '大さじ2' }],
    ['塩こしょう 少々', { name: '塩こしょう', amount: '少々' }],
    ['豚バラ肉200g', { name: '豚バラ肉', amount: '200g' }],
    ['塩少々', { name: '塩', amount: '少々' }],
    ['2 cups flour', { name: 'flour', amount: '2 cups' }],
    ['サラダ油', { name: 'サラダ油', amount: '' }],
    ['■A', { name: 'A', amount: '', heading: true }],
    ['【合わせ調味料】', { name: '【合わせ調味料】', amount: '', heading: true }]
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(splitIngredientLine(input), expected, input);
  }
});

test('手順の整形とタイマー検出', () => {
  assert.deepEqual(parseStepsText('1. 玉ねぎを切る\n\n② 炒める\n(3) 煮込む'), ['玉ねぎを切る', '炒める', '煮込む']);
  assert.deepEqual(findTimers('弱火で10分煮込み、5〜6分蒸らす'), [
    { label: '10分', seconds: 600 },
    { label: '5〜6分', seconds: 360 }
  ]);
  assert.deepEqual(findTimers('1時間30分寝かせる'), [{ label: '1時間30分', seconds: 5400 }]);
  assert.deepEqual(findTimers('30秒加熱'), [{ label: '30秒', seconds: 30 }]);
  assert.deepEqual(findTimers('2時間漬ける'), [{ label: '2時間', seconds: 7200 }]);
});

test('ISO期間', () => {
  assert.equal(isoDurationToMinutes('PT1H30M'), 90);
  assert.equal(isoDurationToMinutes('PT15M'), 15);
  assert.equal(isoDurationToMinutes('P0DT0H20M'), 20);
});

test('JSON-LD（@graph・HowToSection）からレシピを読み取る', () => {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: 'page' },
      {
        '@type': 'Recipe',
        name: '基本の肉じゃが &amp; ごはん',
        description: '<p>ほっとする味</p>',
        image: [{ '@type': 'ImageObject', url: '/img/nikujaga.jpg' }],
        recipeYield: '2人分',
        totalTime: 'PT40M',
        recipeCategory: '和食',
        keywords: '煮物, 定番',
        recipeIngredient: ['じゃがいも 2個', '牛こま切れ肉 150g', '醤油 大さじ2'],
        recipeInstructions: [
          { '@type': 'HowToSection', name: '下ごしらえ', itemListElement: [{ '@type': 'HowToStep', text: 'じゃがいもを切る。' }] },
          { '@type': 'HowToStep', text: '1. 中火で15分煮る。' }
        ]
      }
    ]
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head></html>`;
  const { found, recipe } = parseRecipeHtml(html, 'https://example.com/recipes/1');
  assert.equal(found, true);
  assert.equal(recipe.title, '基本の肉じゃが & ごはん');
  assert.equal(recipe.description, 'ほっとする味');
  assert.equal(recipe.imageUrl, 'https://example.com/img/nikujaga.jpg');
  assert.equal(recipe.servings, 2);
  assert.equal(recipe.totalMinutes, 40);
  assert.deepEqual(recipe.tags, ['和食', '煮物', '定番']);
  assert.deepEqual(recipe.ingredients[1], { name: '牛こま切れ肉', amount: '150g' });
  assert.deepEqual(recipe.steps, ['【下ごしらえ】', 'じゃがいもを切る。', '中火で15分煮る。']);
});

test('レシピ情報がないページはタイトルと画像だけ', () => {
  const html = '<html><head><meta property="og:title" content="今日の晩ごはん"><meta property="og:image" content="https://x.jp/a.jpg"></head></html>';
  const { found, recipe } = parseRecipeHtml(html, 'https://x.jp/blog');
  assert.equal(found, false);
  assert.equal(recipe.title, '今日の晩ごはん');
  assert.equal(recipe.imageUrl, 'https://x.jp/a.jpg');
});
