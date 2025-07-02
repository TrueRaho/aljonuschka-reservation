const bcrypt = require("bcryptjs")

async function generateHashes() {
  const staffPassword = "staff123"
  const adminPassword = "admin456"

  const staffHash = await bcrypt.hash(staffPassword, 12)
  const adminHash = await bcrypt.hash(adminPassword, 12)

  console.log("Staff password hash:", staffHash)
  console.log("Admin password hash:", adminHash)

  console.log("\nSQL to update the database:")
  console.log(`UPDATE auth_passwords SET password_hash = '${staffHash}' WHERE role = 'staff';`)
  console.log(`UPDATE auth_passwords SET password_hash = '${adminHash}' WHERE role = 'admin';`)
}

generateHashes().catch(console.error)
