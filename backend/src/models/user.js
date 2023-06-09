const Tandem = require('./tandem')
const mongoose = require('mongoose')
const autopopulate = require('mongoose-autopopulate')
const passportLocalMongoose = require('passport-local-mongoose')

const userSchema = new mongoose.Schema({
  name: String,
  targetLanguage: String,
  offeredLanguage: String,
  tandems: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tandem',
      autopopulate: { maxDepth: 1 },
    },
  ],
  availabilities: [
    {
      date: String,
      time: String,
    },
  ],
  ratings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rating',
    },
  ],
  rating: Number,
})

userSchema.plugin(autopopulate) // why not use it like in the example of npm?
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' })
class User {
  async initiateTandem(partner, language, date, time) {
    const tandem = await Tandem.create({
      user: this,
      partner: partner,
      language: language,
      date: date,
      time: time,
    })
    tandem.status = 'initiated'
    this.tandems.push(tandem)
    partner.tandems.push(tandem)
    await this.save()
    await partner.save()

    return tandem
  }

  acceptTandem(tandem) {
    tandem.status = 'accepted'
    const { date } = tandem
    const { user, partner } = tandem
    ;[user, partner].forEach(u => {
      u.availabilities = u.availabilities.filter(avail => avail.date !== date) // remove availability for that date
    })
  }

  declineTandem(tandem) {
    tandem.status = 'declined'
  }

  cancelTandem(tandem) {
    tandem.status = 'cancelled'
  }

  get pendingAcceptanceTandems() {
    return this.tandems.filter(tandem => tandem.status === 'initiated' && tandem.partner === this)
  }

  rateUser(user, rating) {
    user.ratings.push(rating)
    const averageRating = user.ratings.reduce((sum, rating) => sum + rating, 0) / user.ratings.length
    user.rating = averageRating.toFixed(1)
  }

  async addAvailability(date, time) {
    this.availabilities.push({ date, time })
  }

  removeAvailability(date, time) {
    this.availabilities = this.availabilities.filter(avail => avail.date !== date || avail.time !== time)
  }

  get details() {
    return `Name: ${this.name}
    Wants: ${this.targetLanguage}
    Offers: ${this.offeredLanguage}
    Rating: ${this.rating}
Tandems:\n${this.tandems
      .map(tandem => {
        let status = tandem.status

        if (status === 'initiated') {
          if (this === tandem.user) {
            status = 'sent'
          } else {
            status = 'received'
          }
        }

        return `- ${tandem.user.name} and ${tandem.partner.name} (${tandem.language}) on ${tandem.date} at ${tandem.time} (${status})`
      })
      .join('\n')}
Availabilities:\n${this.availabilities.map(avail => `- ${avail.date} at ${avail.time}`).join('\n')}`
  }
}

userSchema.loadClass(User) // add methods to schema

module.exports = mongoose.model('User', userSchema)
