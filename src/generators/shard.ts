// SHARD-SOURCE AP16: Brasscap Mesa whole, as one scene module, like Mossgate (sharddev src/shards/mossgate). `wildshard
// build` runs this as the shard's generator; `wildshard watch` calls its describe() and streams the parts to a page.
import { defineShard } from '@wildshard/sharddev/scene/shard';
import { buildBrasscap } from './world';

export const brasscap = defineShard({ slug: 'brasscap-mesa', name: 'Brasscap Mesa', author: 'Local author', revision: 1, seed: 1 }, buildBrasscap);
