import './css/cowAlert.scss'

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))

export let CowAlert = {
	install(Vue) {
		const state = Vue.observable({
			alerts: [],
		})
		Vue.createCowAlert = function (msg, status) {
			// 0 = Info, 1 = Alert, 2 = Warning

			const alert = {
				msg,
				type: status,
				id: rand(0, 2048),

				timeoutId: setTimeout(() => {
					alert.remove()
					alert.timeoutId = null
				}, 4000),
				override() {
					clearTimeout(this.timeoutId)
					this.timeoutId = null
					this.remove()
				},

				remove() {
					state.alerts = state.alerts.filter((x) => x.id !== this.id)
				},
			}

			state.alerts.push(alert)
		}

		Vue.component('cowalert', {
			methods: {
				get_alert_type(index) {
					return ['info', 'alert', 'warning'][index] || 'info'
				},
				delete_alert(el) {
					el.override()
				},
			},
			computed: {
				alerts() {
					return state.alerts
				},
			},

			template: `
					<div id="cowalert">
						<transition-group name="cowalert-list" class="list">
							<span v-for="(alert,index) of alerts" :key="'alert-'+alert.id" :class="[ get_alert_type(alert.type) ]" @click="delete_alert(alert)">
								{{ alert.msg }}
							</span>
						</transition-group>
					</div>
				`,
		})
	},
}
