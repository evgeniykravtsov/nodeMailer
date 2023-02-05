const nodemailer = require('nodemailer');
const axios = require('axios');
const cheerio = require('cheerio');
const Redis = require("ioredis");

const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

require('dotenv').config()

let cache = [17075, 16740, 16741, 16956, 16724, 17056, 16945, 17049, 16995];
console.log(process.env.REDIS_URL, 'process.env.REDIS_URL')
const redis = new Redis(process.env.REDIS_URL)

let mailOptions = {
    from: process.env.USER_EMAIL,
    to: '',
    subject: process.env.USER_SUBJECT,
    text: process.env.USER_TEXT,
};

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

const parseDevPost = async () => {
    let res = await axios.get('https://devpost.com/api/hackathons?order_by=recently-added&status[]=upcoming')
    return res.data
}

async function main() {
    let data = await parseDevPost();
    await redis.sadd("hackathons-id-cache", cache);

    await redis.smembers("hackathons-id-cache", function(err, cache) {
        console.log(cache, "<<<<<hackathons-id-cache");
      });
    
    data.hackathons.forEach(async ({url, id}) => {
        const fromCache = await redis.sismember("hackathons-id-cache", id);

        if(fromCache){
            console.log('id in cache =>>>>>', id);
            console.log('url in cache =>>>>>', url);
            return;
        } 
        let page = await axios.get(url);
        const $ = cheerio.load(page.data);
        const mail = $('a[href^="mailto:"]').attr("href").replace("mailto:", "") || "";

        if(mail && typeof mail === 'string') {
            console.log('отсылаем по адресу ', mail);
            transporter.sendMail({...mailOptions , to: mail }, async (error, info) => {
                await redis.sadd("hackathons-id-cache", id);
                if (error) console.log(error);
                else console.log('Email sent: ' + info.response);
            })
        } else return;
  })

}

app.get("/", (req, res) => {
    main();

    res.send({ title: 'ok!' });});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
  
