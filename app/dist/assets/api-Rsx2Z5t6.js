import{c as e}from"./index-D__DIMv4.js";function t(e){if(!e||typeof e!=`object`)return e;if(Array.isArray(e))return e.map(t);let n={};for(let r in e)n[r.trim()]=t(e[r]);return n}var n=new Map,r=55e3;async function i(i){let a=Date.now(),o=n.get(i);if(o&&o.expires>a)return o.data;let s=await fetch(`${e}${i}`);if(!s.ok)throw Error(`HTTP ${s.status}`);let c=t(await s.json());return n.set(i,{data:c,expires:a+r}),c}async function a(){return i(`/api/loto-complet`)}async function o(){return i(`/api/bilan`)}async function s(){return i(`/api/stats`)}async function c(){return i(`/api/test`)}export{c as i,a as n,s as r,o as t};

export { n }

export { i, t }