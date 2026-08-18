/**
 * scripts/set-demo-avatars.js — 把本地照片换成演示账号的头像
 *
 * seed.js 给所有人用的是同一张生成头像（DEMO_PHOTO_URL），所以演示里每个人长得一样，
 * 申请人列表尤其明显。这个脚本把你自己的照片传到 Supabase Storage 的 public `avatars`
 * bucket，再写回 users.profile_photo_url。
 *
 * ## 用法
 *
 *   1. 在项目根目录建一个 demo-avatars/ 文件夹
 *   2. 把照片放进去，文件名决定给谁用，两种写法都认：
 *
 *        guest1.jpg          → 邮箱前缀，对上 guest1@test.com
 *        wei-jie-lim.jpg     → 姓名，连字符或空格都行，大小写不敏感
 *
 *   3. node scripts/set-demo-avatars.js
 *
 * 支持 .jpg / .jpeg / .png / .webp。图片建议裁成正方形，头像位是圆形显示的。
 *
 * ## 注意
 *
 * - 这个脚本**独立于 seed-demo.js**，不会被它调用。跑完 seed 之后再跑这个，
 *   因为 seed.js 会把 profile_photo_url 重置回默认值。
 * - 传上去的文件在 public bucket 里，任何人拿到 URL 都能看。别放不该公开的照片。
 * - 想还原成默认头像：node scripts/set-demo-avatars.js --reset
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（放在 .env.local）')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SOURCE_DIR = path.join(__dirname, '..', 'demo-avatars')
const BUCKET = 'avatars'
const PREFIX = 'demo'
const DEFAULT_PHOTO = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// "Wei Jie Lim" 和 "wei-jie-lim" 和 "wei_jie_lim" 归一成同一个键。
function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

async function resetAll() {
  const { data, error } = await supabase
    .from('users').update({ profile_photo_url: DEFAULT_PHOTO })
    .not('profile_photo_url', 'eq', DEFAULT_PHOTO).select('id')
  if (error) { console.error('还原失败:', error.message); process.exit(1) }
  console.log(`✓ 已把 ${(data ?? []).length} 个人的头像还原成默认`)
}

async function main() {
  if (process.argv.includes('--reset')) return resetAll()

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`找不到 ${SOURCE_DIR}`)
    console.error('先建这个文件夹，把照片放进去，文件名用邮箱前缀（guest1.jpg）或姓名（wei-jie-lim.jpg）')
    process.exit(1)
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => EXTENSIONS.includes(path.extname(f).toLowerCase()))
  if (files.length === 0) {
    console.error(`${SOURCE_DIR} 里没有图片（支持 ${EXTENSIONS.join(' / ')}）`)
    process.exit(1)
  }

  const { data: users, error } = await supabase.from('users').select('id, full_name, email_address, role')
  if (error) { console.error('读取 users 失败:', error.message); process.exit(1) }

  // 同一个人可以用邮箱前缀或姓名两种方式命中。
  const byKey = new Map()
  for (const user of users ?? []) {
    byKey.set(slug((user.email_address ?? '').split('@')[0]), user)
    byKey.set(slug(user.full_name), user)
  }

  let done = 0
  const missed = []
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const user = byKey.get(slug(path.basename(file, ext)))
    if (!user) { missed.push(file); continue }

    const remotePath = `${PREFIX}/${user.id}${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(
      remotePath, fs.readFileSync(path.join(SOURCE_DIR, file)),
      { contentType: MIME[ext], upsert: true },
    )
    if (upErr) { console.warn(`⚠ 上传 ${file} 失败: ${upErr.message}`); continue }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(remotePath)
    // 加一个时间戳查询串，覆盖同名文件后浏览器才会重新拉，不然会一直显示旧图。
    const url = `${pub.publicUrl}?v=${Date.now()}`

    const { error: updErr } = await supabase.from('users').update({ profile_photo_url: url }).eq('id', user.id)
    if (updErr) { console.warn(`⚠ 写 ${user.full_name} 的头像失败: ${updErr.message}`); continue }

    console.log(`  ✓ ${file}  →  ${user.full_name} (${user.role})`)
    done++
  }

  console.log(`\n✓ 换好 ${done} 个头像`)
  if (missed.length > 0) {
    console.log(`\n⚠ 这些文件名没对上任何人，跳过了：${missed.join('、')}`)
    console.log('  文件名要么是邮箱前缀（guest1、manager1、casual3），要么是姓名（wei-jie-lim）')
  }
  console.log('\n浏览器硬刷新（Ctrl+Shift+R）才看得到新头像。')
}

main().catch(err => { console.error('\n✗ 脚本异常:', err.message); process.exit(1) })
